const axios = require('axios');
axios.get('http://localhost:3000/api/v1/pieces?limit=2', {
  headers: { Authorization: `Bearer ${process.env.AP_API_KEY || ''}` }
}).then(res => {
  const p = res.data.data ? res.data.data[0] : res.data[0];
  console.log('LOCAL PIECE:', p.name);
  console.log('actions type:', typeof p.actions);
}).catch(e => console.error('Local error:', e.message));
