module.exports = {
  default: {
    require: ['support/*.js', 'step-definitions/*.js'],
    format: [
      'progress-bar',
      'json:reports/cucumber-report.json',
      'html:reports/cucumber-report.html'
    ],
    formatOptions: { snippetInterface: 'async-await' },
    timeout: 60000
  }
};
