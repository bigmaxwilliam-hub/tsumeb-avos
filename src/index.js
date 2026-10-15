// Cloudflare Worker for Tsumeb Avos
// Handles order creation, secure admin authentication, order management, and static asset serving.

// Constant-time string comparison to prevent timing attacks during password check
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  
  if (bufA.length !== bufB.length) {
    // Perform comparison anyway to avoid timing leaks on length
    let dummy = 0;
    for (let i = 0; i < bufA.length; i++) {
      dummy |= bufA[i] ^ bufA[i];
    }
    return false;
  }
  
  let mismatch = 0;
  for (let i = 0; i < bufA.length; i++) {
    mismatch |= bufA[i] ^ bufB[i];
  }
  return mismatch === 0;
}

// HTTP Basic Authentication checker for admin routes
function checkBasicAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }
  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const colonIndex = credentials.indexOf(':');
    if (colonIndex === -1) return false;
    
    const user = credentials.substring(0, colonIndex);
    const pass = credentials.substring(colonIndex + 1);
    
    const expectedUser = 'admin';
    const expectedPass = env.ADMIN_PASSWORD || '';
    
    return timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass);
  } catch (err) {
    return false;
  }
}

// Helper to return unauthorized response prompting for Basic Auth
function unauthorizedResponse() {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Tsumeb Avos Admin"',
      'Content-Type': 'text/plain'
    }
  });
}

// CSV escape helper
function escapeCsvField(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. POST /api/orders: Create new avocado order
    if (path === '/api/orders' && method === 'POST') {
      try {
        const body = await request.json();
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
        const quantity = Number(body.quantity);
        const note = typeof body.note === 'string' ? body.note.trim() : '';

        // Validate name
        if (!name) {
          return Response.json({ error: 'Name is required.' }, { status: 400 });
        }

        // Validate phone
        if (!phone) {
          return Response.json({ error: 'Phone number is required.' }, { status: 400 });
        }

        // Validate quantity (whole number from 1 to 500)
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
          return Response.json({ error: 'Quantity must be a whole number between 1 and 500.' }, { status: 400 });
        }

        const createdAt = new Date().toISOString();
        const status = 'new';

        const stmt = env.DB.prepare(
          'INSERT INTO orders (created_at, name, phone, quantity, note, status) VALUES (?, ?, ?, ?, ?, ?)'
        );
        const result = await stmt.bind(createdAt, name, phone, quantity, note, status).run();

        // Get the inserted row id
        const insertedId = result.meta.last_row_id;

        return Response.json({ success: true, id: insertedId }, { status: 201 });
      } catch (err) {
        return Response.json({ error: 'Invalid JSON request or database error.' }, { status: 400 });
      }
    }

    // 2. Admin API and Pages protection (/admin and /api/admin)
    if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
      if (!checkBasicAuth(request, env)) {
        return unauthorizedResponse();
      }

      // GET /api/admin/orders: Get all orders newest first
      if (path === '/api/admin/orders' && method === 'GET') {
        try {
          const { results } = await env.DB.prepare(
            'SELECT id, created_at, name, phone, quantity, note, status FROM orders ORDER BY id DESC'
          ).all();
          return Response.json(results);
        } catch (err) {
          return Response.json({ error: 'Database error while fetching orders.' }, { status: 500 });
        }
      }

      // POST /api/admin/orders/:id/status: Update order status (new, paid, delivered)
      const statusMatch = path.match(/^\/api\/admin\/orders\/(\d+)\/status$/);
      if (statusMatch && method === 'POST') {
        const orderId = statusMatch[1];
        try {
          const body = await request.json();
          const newStatus = typeof body.status === 'string' ? body.status.toLowerCase().trim() : '';

          if (!['new', 'paid', 'delivered'].includes(newStatus)) {
            return Response.json({ error: 'Invalid status. Allowed values: new, paid, delivered.' }, { status: 400 });
          }

          const updateStmt = env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?');
          const updateRes = await updateStmt.bind(newStatus, orderId).run();

          if (updateRes.meta.changes === 0) {
            return Response.json({ error: 'Order not found.' }, { status: 404 });
          }

          return Response.json({ success: true, id: orderId, status: newStatus });
        } catch (err) {
          return Response.json({ error: 'Invalid request or database error.' }, { status: 400 });
        }
      }

      // GET /api/admin/orders.csv: Download all orders as CSV
      if (path === '/api/admin/orders.csv' && method === 'GET') {
        try {
          const { results } = await env.DB.prepare(
            'SELECT id, created_at, name, phone, quantity, note, status FROM orders ORDER BY id DESC'
          ).all();

          const headers = ['ID', 'Created At (UTC)', 'Name', 'Phone', 'Quantity', 'Note', 'Status'];
          const csvRows = [headers.join(',')];

          for (const row of results) {
            const values = [
              row.id,
              escapeCsvField(row.created_at),
              escapeCsvField(row.name),
              escapeCsvField(row.phone),
              row.quantity,
              escapeCsvField(row.note),
              escapeCsvField(row.status)
            ];
            csvRows.push(values.join(','));
          }

          const csvContent = csvRows.join('\r\n');
          return new Response(csvContent, {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="tsumeb-avos-orders.csv"'
            }
          });
        } catch (err) {
          return new Response('Database error generating CSV.', { status: 500 });
        }
      }
    }

    // 3. Everything else: serve static pages (handled by Cloudflare Workers Assets)
    return env.ASSETS.fetch(request);
  }
};
