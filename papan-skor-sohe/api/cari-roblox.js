export default async function handler(req, res) {
  // Izinkan akses dari mana saja
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ sukses: false, pesan: 'Username wajib diisi' });
  }

  try {
    // 1. Ambil User ID langsung dari API resmi Roblox
    const userRes = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
    });

    if (!userRes.ok) {
      return res.status(userRes.status).json({ sukses: false, pesan: 'Gagal menghubungi Roblox' });
    }

    const userData = await userRes.json();
    const user = (userData.data || [])[0];

    if (!user || !user.id) {
      return res.status(404).json({ sukses: false, pesan: 'Akun tidak ditemukan' });
    }

    // 2. Ambil Foto Avatar Headshot resmi
    let avatarUrl = '';
    const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=true`);
    if (thumbRes.ok) {
      const thumbData = await thumbRes.json();
      if (thumbData.data && thumbData.data[0]) {
        avatarUrl = thumbData.data[0].imageUrl;
      }
    }

    return res.status(200).json({
      sukses: true,
      userId: user.id,
      userName: user.name,
      displayName: user.displayName || user.name,
      avatarUrl: avatarUrl
    });
  } catch (error) {
    return res.status(500).json({ sukses: false, pesan: 'Server error: ' + error.message });
  }
}