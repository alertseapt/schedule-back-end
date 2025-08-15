const express = require('express');
const { executeMercocampQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Listar clientes do banco wcl
router.get('/', async (req, res) => {
  try {
    // Buscar todos os clientes do banco wcl
    const allClients = await executeMercocampQuery('SELECT cnpj_cpf, nome_cliente FROM wcl');
    
    // Verificar se o usuário tem acesso total ou restrito
    if (req.user._clientAccessCache.hasFullAccess) {
      // Usuário com acesso total - retornar todos os clientes
      return res.json({
        data: allClients.map(c => ({ cnpj: c.cnpj_cpf, name: c.nome_cliente }))
      });
    } else {
      // Usuário com acesso restrito - filtrar apenas os clientes permitidos
      const allowedClients = req.user._clientAccessCache.allowedClients;
      
      // Se não tiver acesso a nenhum cliente, retornar lista vazia
      if (allowedClients.length === 0) {
        return res.json({
          data: []
        });
      }
      
      // Filtrar apenas os clientes permitidos
      const filteredClients = allClients.filter(client => {
        // Normalizar CNPJ para comparação
        const normalizedCNPJ = normalizeCNPJ(client.cnpj_cpf);
        return allowedClients.includes(normalizedCNPJ);
      });
      
      return res.json({
        data: filteredClients.map(c => ({ cnpj: c.cnpj_cpf, name: c.nome_cliente }))
      });
    }
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Função helper para normalizar CNPJ (remover máscara)
function normalizeCNPJ(cnpj) {
  if (cnpj === null || typeof cnpj === 'undefined') {
    return ''; // Retorna uma string vazia se o CNPJ for nulo ou indefinido
  }
  return String(cnpj).replace(/[^\d]/g, '');
}

// Validar se CNPJ existe na tabela wcl
router.post('/validate-cnpj', async (req, res) => {
  try {
    const { cnpj } = req.body;
    
    if (!cnpj) {
      return res.status(400).json({ error: 'CNPJ é obrigatório' });
    }

    // Normalizar CNPJ (remover máscara se houver)
    const normalizedCNPJ = normalizeCNPJ(cnpj);
    
    // Verificar se o usuário tem acesso ao cliente
    // Usuários nível 0 têm acesso total, outros precisam verificar cli_access
    if (!req.user._clientAccessCache.hasFullAccess) {
      const allowedClients = req.user._clientAccessCache.allowedClients;
      
      if (!allowedClients.includes(normalizedCNPJ)) {
        return res.status(403).json({
          error: 'Você não tem permissão para validar este cliente'
        });
      }
    }
    
    // Buscar cliente pelo CNPJ na tabela wcl usando REPLACE para remover máscara
    const clients = await executeMercocampQuery(
      `SELECT cnpj_cpf, nome_cliente FROM wcl WHERE REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '/', ''), '-', '') = ?`,
      [normalizedCNPJ]
    );
    
    const exists = clients.length > 0;
    
    res.json({
      exists,
      client: exists ? { cnpj: clients[0].cnpj_cpf, name: clients[0].nome_cliente } : null
    });
    
  } catch (error) {
    console.error('Erro ao validar CNPJ:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
