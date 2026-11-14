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
  const userIdParam = requestUrl.searchParams.get('userId') || req.query.userId;

  if (!username && !userIdParam) {
    return res.status(400).json({ sukses: false, pesan: 'Username atau User ID wajib diisi' });
  }

  try {
    let user = null;

    if (userIdParam) {
      // Cari langsung via User ID
      const uidRes = await fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(userIdParam)}`);
      if (uidRes.ok) {
        const uData = await uidRes.json();
        if (uData && uData.id) {
          user = { id: uData.id, name: uData.name, displayName: uData.displayName || uData.name };
        }
      }
    }

    if (!user && username) {
      const cleanUser = username.trim().replace(/^@+/, '');

      // 1. Cari via exact username
      const userApiUrl = new URL('https://users.roblox.com/v1/usernames/users');
      const userRes = await fetch(userApiUrl.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [cleanUser], excludeBannedUsers: false })
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.data && userData.data[0] && userData.data[0].id) {
          const u = userData.data[0];
          user = { id: u.id, name: u.name, displayName: u.displayName || u.name };
        }
      }

      // 2. Jika tidak ditemukan, cari via search keyword (bisa jadi Display Name)
      if (!user) {
        const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(cleanUser)}&limit=10`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.data && searchData.data[0] && searchData.data[0].id) {
            const u = searchData.data[0];
            user = { id: u.id, name: u.name, displayName: u.displayName || u.name };
          }
        }
      }
    }

    if (!user || !user.id) {
      return res.status(404).json({ sukses: false, pesan: 'Akun Roblox tidak ditemukan' });
    }

    // 2. Ambil Avatar Headshot (150x150 circular untuk tabel meja)
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

    // 3. Ambil Avatar Full Body HD (720x720 / 420x420 non-circular untuk Podium 3D)
    let avatar3dUrl = '';
    for (const sz of ['720x720', '420x420', '352x352']) {
      try {
        const fullThumbUrl = new URL('https://thumbnails.roblox.com/v1/users/avatar');
        fullThumbUrl.searchParams.set('userIds', user.id);
        fullThumbUrl.searchParams.set('size', sz);
        fullThumbUrl.searchParams.set('format', 'Png');
        fullThumbUrl.searchParams.set('isCircular', 'false');

        const fullRes = await fetch(fullThumbUrl.href);
        if (fullRes.ok) {
          const fullData = await fullRes.json();
          if (fullData.data && fullData.data[0] && fullData.data[0].imageUrl) {
            avatar3dUrl = fullData.data[0].imageUrl;
            break;
          }
        }
      } catch (e) {}
    }

    const fallbackAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=0284c7`;

    return res.status(200).json({
      sukses: true,
      userId: user.id,
      userName: user.name,
      displayName: user.displayName || user.name,
      avatarUrl: avatarUrl || fallbackAvatar,
      avatar3dUrl: avatar3dUrl || ''
    });

  } catch (error) {
    return res.status(500).json({ sukses: false, pesan: 'Kesalahan Server: ' + error.message });
  }
}
