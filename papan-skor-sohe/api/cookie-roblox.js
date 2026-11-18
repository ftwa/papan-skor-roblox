export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. GET: Ambil status cookie atau verifikasi
  if (req.method === 'GET') {
    const rawCookie = (req.query && req.query.cookie) || process.env.ROBLOX_COOKIE || '';
    const cleanCookie = String(rawCookie).trim().replace(/^['"]|['"]$/g, '');

    if (!cleanCookie || cleanCookie.includes('MASUKKAN_') || cleanCookie.includes('KODE_COOKIE')) {
      return res.status(200).json({
        hasCookie: false,
        isValid: false,
        pesan: 'Cookie Roblox belum diatur. Klik tombol Cookie untuk menghubungkan akun Roblox.'
      });
    }

    try {
      const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', {
        headers: {
          'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!authRes.ok) {
        return res.status(200).json({
          hasCookie: true,
          isValid: false,
          pesan: 'Cookie sudah kadaluarsa atau tidak valid (HTTP 401).'
        });
      }

      const authData = await authRes.json();
      const uid = authData.id;
      const uname = authData.name;
      const dname = authData.displayName || uname;

      let avatarUrl = '';
      try {
        const avRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Png&isCircular=true`);
        if (avRes.ok) {
          const avData = await avRes.json();
          if (avData.data && avData.data.length > 0) {
            avatarUrl = avData.data[0].imageUrl || '';
          }
        }
      } catch (_) {}

      const masked = cleanCookie.length > 26 ? (cleanCookie.slice(0, 18) + '...' + cleanCookie.slice(-8)) : '***';

      return res.status(200).json({
        hasCookie: true,
        isValid: true,
        userId: uid,
        username: uname,
        displayName: dname,
        avatarUrl: avatarUrl,
        masked: masked,
        pesan: `Akun @${uname} (${dname}) aktif terhubung!`
      });
    } catch (err) {
      return res.status(200).json({
        hasCookie: true,
        isValid: false,
        pesan: 'Gagal menghubungi server Roblox: ' + err.message
      });
    }
  }

  // 2. POST: Tes atau Simpan Cookie
  if (req.method === 'POST') {
    const rawCookie = (req.body && req.body.cookie) || '';
    let cleanCookie = String(rawCookie).trim().replace(/^['"]|['"]$/g, '');
    if (cleanCookie.startsWith('.ROBLOSECURITY=')) {
      cleanCookie = cleanCookie.split('=').slice(1).join('=').trim();
    }

    if (!cleanCookie) {
      return res.status(200).json({
        sukses: true,
        hasCookie: false,
        isValid: false,
        pesan: 'Cookie Roblox berhasil dihapus.'
      });
    }

    try {
      const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', {
        headers: {
          'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!authRes.ok) {
        return res.status(400).json({
          sukses: false,
          isValid: false,
          pesan: 'Cookie kadaluarsa atau tidak valid di Roblox (HTTP 401). Silakan periksa kembali.'
        });
      }

      const authData = await authRes.json();
      const uid = authData.id;
      const uname = authData.name;
      const dname = authData.displayName || uname;

      let avatarUrl = '';
      try {
        const avRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Png&isCircular=true`);
        if (avRes.ok) {
          const avData = await avRes.json();
          if (avData.data && avData.data.length > 0) {
            avatarUrl = avData.data[0].imageUrl || '';
          }
        }
      } catch (_) {}

      const masked = cleanCookie.length > 26 ? (cleanCookie.slice(0, 18) + '...' + cleanCookie.slice(-8)) : '***';

      return res.status(200).json({
        sukses: true,
        hasCookie: true,
        isValid: true,
        userId: uid,
        username: uname,
        displayName: dname,
        avatarUrl: avatarUrl,
        masked: masked,
        cookie: cleanCookie,
        pesan: `Cookie berhasil diverifikasi untuk akun @${uname} (${dname})!`
      });
    } catch (err) {
      return res.status(500).json({
        sukses: false,
        pesan: 'Gagal verifikasi cookie: ' + err.message
      });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
