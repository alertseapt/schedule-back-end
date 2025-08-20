#!/usr/bin/env node

// Script para testar a configuração CORS
// Execute: node test-cors.js

console.log('=== TESTE DE CONFIGURAÇÃO CORS ===\n');

// Simular diferentes ambientes
const testEnvironments = [
  { name: 'Desenvolvimento Local', cwd: 'C:\\Users\\Projetos\\Documents\\Projetos Cursor\\agenda-mercocamp\\schedule-back-end' },
  { name: 'IIS Server', cwd: 'C:\\inetpub\\wwwroot\\schedule_mercocamp\\schedule-back-end' },
  { name: 'Produção', cwd: '/app' }
];

testEnvironments.forEach(env => {
  console.log(`\n--- Testando: ${env.name} ---`);
  
  // Simular process.cwd()
  const originalCwd = process.cwd;
  process.cwd = () => env.cwd;
  
  try {
    // Detectar se está rodando no IIS
    const isRunningOnIIS = env.cwd.includes('inetpub') || env.cwd.includes('wwwroot');
    console.log(`🖥️ Executando no IIS: ${isRunningOnIIS ? 'SIM' : 'NÃO'}`);
    
    // Carregar configuração
    let config;
    if (isRunningOnIIS) {
      console.log(`✅ Carregando configuração específica para IIS`);
      config = require('./config/iis');
    } else if (env.name === 'Produção') {
      console.log(`✅ Carregando configuração de PRODUÇÃO`);
      config = require('./config/production');
    } else {
      console.log(`✅ Carregando configuração de DESENVOLVIMENTO`);
      config = require('./config/development');
    }
    
    console.log(`📋 Origins permitidos:`);
    config.cors.allowedOrigins.forEach(origin => {
      console.log(`   ✓ ${origin}`);
    });
    
    // Testar origins específicos
    const testOrigins = [
      'http://localhost:8000',
      'http://recebhomolog.mercocamptech.com.br',
      'https://recebhomolog.mercocamptech.com.br'
    ];
    
    console.log(`\n🧪 Testando origins:`);
    testOrigins.forEach(origin => {
      const isAllowed = config.cors.allowedOrigins.includes(origin);
      console.log(`   ${isAllowed ? '✅' : '❌'} ${origin} - ${isAllowed ? 'PERMITIDO' : 'BLOQUEADO'}`);
    });
    
  } catch (error) {
    console.log(`❌ Erro ao carregar configuração: ${error.message}`);
  }
  
  // Restaurar process.cwd
  process.cwd = originalCwd;
});

console.log('\n=== FIM DO TESTE ===');
console.log('\nPara aplicar as mudanças, reinicie o servidor backend.');
