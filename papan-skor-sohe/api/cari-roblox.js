export default async function handler(req, res) {
  // Header CORS agar bisa diakses dari domain frontend Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Menggunakan WHATWG URL API modern untuk parsing query parameter
  const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const username = requestUrl.searchParams.get('username') || req.query.username;

  if (!username || !username.trim()) {
    return res.status(400).json({ sukses: false, pesan: 'Username wajib diisi' });
  }

  const cleanUser = username.trim().replace(/^@+/, '');

  try {
    // 1. Cari User ID ke API Roblox
    const userApiUrl = new URL('https://users.roblox.com/v1/usernames/users');
    const userRes = await fetch(userApiUrl.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [cleanUser], excludeBannedUsers: false })
    });

    if (!userRes.ok) {
      return res.status(userRes.status).json({ sukses: false, pesan: 'Gagal menghubungi server Roblox' });
    }

    const userData = await userRes.json();
    const user = (userData.data || [])[0];

    if (!user || !user.id) {
      return res.status(404).json({ sukses: false, pesan: 'Akun Roblox tidak ditemukan' });
    }

    // 2. Ambil Avatar Headshot
    let avatarUrl = '';
    const thumbApiUrl = new URL('https://thumbnails.roblox.com/v1/users/avatar-headshot');
    thumbApiUrl.searchParams.set('userIds', user.id);
    thumbApiUrl.searchParams.set('size', '150x150');
    thumbApiUrl.searchParams.set('format', 'Png');
    thumbApiUrl.searchParams.set('isCircular', 'true');

    const thumbRes = await fetch(thumbApiUrl.href);
    if (thumbRes.ok) {
      const thumbData = await thumbRes.json();
      if (thumbData.data && thumbData.data[0] && thumbData.data[0].imageUrl) {
        avatarUrl = thumbData.data[0].imageUrl;
      }
    }

    return res.status(200).json({
      sukses: true,
      userId: user.id,
      userName: user.name,
      displayName: user.displayName || user.name,
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUser)}&backgroundColor=0284c7`
    });

  } catch (error) {
    return res.status(500).json({ sukses: false, pesan: 'Kesalahan Server: ' + error.message });
  }
}
