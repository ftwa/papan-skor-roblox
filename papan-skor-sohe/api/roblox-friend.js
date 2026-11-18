export default async function handler(req, res) {
  // Header CORS agar bisa diakses dari frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parsing parameter dari POST body atau GET query
  let body = {};
  if (req.method === 'POST') {
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (e) {
      body = {};
    }
  }

  const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const action = req.query.action || body.action || requestUrl.searchParams.get('action') || 'add_friend';
  const cookie = (req.query.cookie || body.cookie || requestUrl.searchParams.get('cookie') || '').trim();
  const targetUserId = req.query.targetUserId || body.targetUserId || requestUrl.searchParams.get('targetUserId');
  const targetUsername = req.query.targetUsername || body.targetUsername || requestUrl.searchParams.get('targetUsername');

  if (!cookie) {
    return res.status(400).json({ sukses: false, pesan: 'Cookie Roblox (.ROBLOSECURITY) belum diisi!' });
  }

  // Format cookie string agar selalu valid
  let cleanCookie = cookie;
  if (!cleanCookie.startsWith('.ROBLOSECURITY=')) {
    cleanCookie = `.ROBLOSECURITY=${cleanCookie}`;
  }

  try {
    // 1. ACTION: Cek validitas cookie & informasi akun yang login
    if (action === 'check_cookie') {
      const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', {
        headers: {
          'Cookie': cleanCookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      if (!authRes.ok) {
        return res.status(401).json({ sukses: false, pesan: 'Cookie tidak valid atau sudah kedaluwarsa (HTTP ' + authRes.status + ')' });
      }

      const authData = await authRes.json();

      // Ambil juga avatar headshot akun yang login
      let avatarUrl = '';
      try {
        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${authData.id}&size=150x150&format=Png&isCircular=true`);
        if (thumbRes.ok) {
          const thumbData = await thumbRes.json();
          if (thumbData.data && thumbData.data[0]) {
            avatarUrl = thumbData.data[0].imageUrl;
          }
        }
      } catch (e) {}

      return res.status(200).json({
        sukses: true,
        userId: authData.id,
        name: authData.name,
        displayName: authData.displayName || authData.name,
        avatarUrl: avatarUrl
      });
    }

    // 2. ACTION: Kirim permintaan pertemanan (Auto Add Friend)
    if (action === 'add_friend') {
      let finalTargetId = targetUserId;

      // Jika targetUserId belum ada, cari via targetUsername
      if (!finalTargetId && targetUsername) {
        const cleanUser = targetUsername.trim().replace(/^@+/, '');
        const uRes = await fetch('https://users.roblox.com/v1/usernames/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames: [cleanUser], excludeBannedUsers: false })
        });
        if (uRes.ok) {
          const uData = await uRes.json();
          if (uData.data && uData.data[0]) {
            finalTargetId = uData.data[0].id;
          }
        }
      }

      if (!finalTargetId) {
        return res.status(400).json({ sukses: false, pesan: 'Target User ID atau Username Roblox tidak ditemukan!' });
      }

      // Step A: Ambil X-CSRF-TOKEN dari Roblox
      let csrfToken = '';
      const csrfRes = await fetch('https://auth.roblox.com/v2/login', {
        method: 'POST',
        headers: {
          'Cookie': cleanCookie,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: '{}'
      });

      csrfToken = csrfRes.headers.get('x-csrf-token') || '';

      if (!csrfToken) {
        const csrfRes2 = await fetch('https://auth.roblox.com/v1/logout', {
          method: 'POST',
          headers: {
            'Cookie': cleanCookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });
        csrfToken = csrfRes2.headers.get('x-csrf-token') || '';
      }

      if (!csrfToken) {
        return res.status(403).json({ sukses: false, pesan: 'Gagal mendapatkan CSRF Token Roblox. Pastikan cookie masih aktif!' });
      }

      // Step B: Kirim permintaan pertemanan ke Roblox Friends API
      const friendUrl = `https://friends.roblox.com/v1/users/${finalTargetId}/request-friendship`;
      const friendRes = await fetch(friendUrl, {
        method: 'POST',
        headers: {
          'Cookie': cleanCookie,
          'x-csrf-token': csrfToken,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: JSON.stringify({ friendshipOriginSourceType: 0 })
      });

      const friendData = await friendRes.json().catch(() => ({}));

      if (friendRes.ok) {
        const isCaptcha = friendData && friendData.isCaptchaRequired;
        if (isCaptcha) {
          return res.status(200).json({
            sukses: false,
            pesan: 'Roblox membutuhkan verifikasi Captcha untuk permintaan ini. Silakan add manual di Roblox.',
            isCaptchaRequired: true
          });
        }
        return res.status(200).json({
          sukses: true,
          pesan: 'Permintaan pertemanan berhasil dikirim!'
        });
      } else {
        let errMsg = 'Gagal menambahkan teman';
        if (friendData && friendData.errors && friendData.errors[0]) {
          const code = friendData.errors[0].code;
          const msg = friendData.errors[0].message;
          if (msg.includes('already friends') || code === 2) {
            errMsg = 'Akun ini sudah menjadi teman Anda!';
          } else if (msg.includes('request already') || code === 3) {
            errMsg = 'Permintaan pertemanan sudah pernah dikirim sebelumnya!';
          } else if (msg.includes('limit') || code === 4) {
            errMsg = 'Batas maksimal pertemanan (Friends Limit) telah tercapai!';
          } else {
            errMsg = msg;
          }
        } else if (friendRes.status === 429) {
          errMsg = 'Terlalu banyak permintaan (Rate limited). Tunggu beberapa saat!';
        } else if (friendRes.status === 401) {
          errMsg = 'Cookie Roblox kedaluwarsa atau tidak memiliki izin!';
        }
        return res.status(friendRes.status || 400).json({ sukses: false, pesan: errMsg });
      }
    }

    return res.status(400).json({ sukses: false, pesan: 'Action tidak dikenali' });

  } catch (error) {
    return res.status(500).json({ sukses: false, pesan: 'Kesalahan Server: ' + error.message });
  }
}
