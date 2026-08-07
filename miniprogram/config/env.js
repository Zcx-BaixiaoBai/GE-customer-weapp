var ENV = {
  dev: {
    // 真机调试用电脑局域网IP，开发者工具也可以用这个IP
    // 注意：IP会随WiFi网络变化，真机连不上时先ipconfig确认当前IP
    API_BASE_URL: 'http://192.168.10.48:3001/api',
    FASTGPT_BASE_URL: 'http://192.168.10.48:3000/api/v1',
    FASTGPT_API_KEY: 'fastgpt-sKWqfSvj9qrl7Yo1XvM4F1LS2Tf7Y8s80IR7As7qvFqiaT2kbgg4I4ALG4tko8sy',
    FASTGPT_APP_ID: '',
    PMS_API: 'https://pms-api.jinying.com/api',
    PMS_COUNTER_ID: '23908'
  },
  prod: {
    API_BASE_URL: 'https://api.jinying.world/api',
    FASTGPT_BASE_URL: 'https://ai.jinying.world/api/v1',
    FASTGPT_API_KEY: '',
    FASTGPT_APP_ID: '',
    PMS_API: 'https://pms-api.jinying.com/api',
    PMS_COUNTER_ID: '23908'
  }
};

var CURRENT_ENV = 'dev';

module.exports = {
  config: ENV[CURRENT_ENV]
};
