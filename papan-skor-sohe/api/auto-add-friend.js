export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawUser = (req.body && req.body.username) || (req.query && req.query.username) || '';
  const cleanUser = String(rawUser).trim().replace(/^@+/, '').trim();

  let rawCookie = (req.body && req.body.cookie) || (req.query && req.query.cookie) || process.env.ROBLOX_COOKIE || '';
  let cleanCookie = String(rawCookie).trim().replace(/^['"]|['"]$/g, '');
  if (cleanCookie.startsWith('.ROBLOSECURITY=')) {
    cleanCookie = cleanCookie.split('=').slice(1).join('=').trim();
  }

  if (!cleanUser) {
    return res.status(400).json({ sukses: false, pesan: 'Username wajib diisi' });
  }

  try {
    let uid = null;
    let userName = cleanUser;
    let displayName = cleanUser;

    const postRes = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ usernames: [cleanUser], excludeBannedUsers: false })
    });

    if (postRes.ok) {
      const data = await postRes.json();
      if (data.data && data.data.length > 0) {
        uid = data.data[0].id;
        userName = data.data[0].name || cleanUser;
        displayName = data.data[0].displayName || userName;
      }
    }

    if (!uid && cleanUser.match(/^\d+$/)) {
      uid = parseInt(cleanUser, 10);
    }

    if (!uid) {
      return res.status(404).json({ sukses: false, status: 'NOT_FOUND', pesan: `User '${cleanUser}' tidak ditemukan di Roblox.` });
    }

    const profileUrl = `https://www.roblox.com/users/${uid}/profile`;

    // Jika ada cookie yang valid, cek relasi pertemanan
    if (cleanCookie && !cleanCookie.includes('MASUKKAN_') && !cleanCookie.includes('KODE_COOKIE')) {
      try {
        const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', {
          headers: {
            'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
            'User-Agent': 'Mozilla/5.0'
          }
        });

        if (authRes.ok) {
          const authData = await authRes.json();
          const botId = authData.id;
          const botName = authData.name;

          if (botId === uid) {
            return res.status(200).json({
              sukses: true,
              status: 'SELF',
              userId: uid,
              username: userName,
              displayName: displayName,
              profileUrl: profileUrl,
              pesan: `@${userName} adalah akun Anda sendiri.`
            });
          }

          const stRes = await fetch(`https://friends.roblox.com/v1/users/${botId}/friends/statuses?userIds=${uid}`, {
            headers: {
              'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
              'User-Agent': 'Mozilla/5.0'
            }
          });

          if (stRes.ok) {
            const stData = await stRes.json();
            if (stData.data && stData.data.length > 0) {
              const rel = stData.data[0].status;
              if (rel === 'Friends') {
                return res.status(200).json({
                  sukses: true,
                  status: 'FRIENDS',
                  userId: uid,
                  username: userName,
                  displayName: displayName,
                  profileUrl: profileUrl,
                  pesan: `@${userName} sudah berteman dengan akun @${botName} di Roblox.`
                });
              } else if (rel === 'RequestSent') {
                return res.status(200).json({
                  sukses: true,
                  status: 'PENDING_SENT',
                  userId: uid,
                  username: userName,
                  displayName: displayName,
                  profileUrl: profileUrl,
                  pesan: `Permintaan pertemanan ke @${userName} sudah terkirim (Pending).`
                });
              }
            }
          }

          // Coba kirim request friendship
          const csrfRes = await fetch('https://auth.roblox.com/v1/logout', {
            method: 'POST',
            headers: { 'Cookie': `.ROBLOSECURITY=${cleanCookie}`, 'User-Agent': 'Mozilla/5.0' }
          });
          const csrfToken = csrfRes.headers.get('x-csrf-token');

          const frRes = await fetch(`https://friends.roblox.com/v1/users/${uid}/request-friendship`, {
            method: 'POST',
            headers: {
              'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
              'X-CSRF-TOKEN': csrfToken || '',
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0'
            },
            body: '{}'
          });

          if (frRes.ok) {
            return res.status(200).json({
              sukses: true,
              status: 'SENT_SUCCESS',
              userId: uid,
              username: userName,
              displayName: displayName,
              profileUrl: profileUrl,
              pesan: `Permintaan pertemanan berhasil dikirim ke @${userName} dari akun @${botName}!`
            });
          }
        }
      } catch (_) {}
    }

    return res.status(200).json({
      sukses: true,
      status: 'USER_FOUND',
      userId: uid,
      username: userName,
      displayName: displayName,
      profileUrl: profileUrl,
      pesan: `Akun @${userName} (${displayName}) ditemukan!`
    });
  } catch (err) {
    return res.status(200).json({
      sukses: true,
      status: 'USER_FOUND',
      username: cleanUser,
      displayName: cleanUser,
      pesan: `Akun @${cleanUser} siap dipasang ke kursi.`
    });
  }
}
