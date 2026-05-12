const https = require('https');
https.get('https://cloud.activepieces.com/api/v1/pieces/@activepieces%2Fpiece-slack', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    try {
      const p = JSON.parse(data);
      console.log('name:', p.name);
      console.log('displayName:', p.displayName);
      console.log('actions type:', typeof p.actions, Array.isArray(p.actions));
      if (typeof p.actions === 'object' && p.actions !== null) {
        const keys = Object.keys(p.actions);
        console.log('# action keys:', keys.length);
        console.log('first key:', keys[0]);
        const first = p.actions[keys[0]];
        console.log('first action:', JSON.stringify(first, null, 2).slice(0, 400));
      }
    } catch(e) {
      console.log('RAW:', data.slice(0, 300));
    }
  });
}).on('error', e => console.error('ERR:', e.message));
