// Entry point para Vercel Serverless Functions
// Este arquivo exporta o app Express existente para a Vercel

const app = require('../app');

// Exportar o app para a Vercel usar como serverless function
module.exports = app;


