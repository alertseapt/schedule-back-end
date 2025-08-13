const axios = require('axios');

/**
 * Serviço de integração com Corpem WMS
 * 
 * Responsável por:
 * 1. Cadastro de Mercadorias (quando status = "Conferência")
 * 2. Integração de NF de Entrada (para todos os agendamentos)
 */
class CorpemIntegrationService {
  constructor() {
    // Configurações do Corpem WMS
    this.config = {
      baseURL: process.env.CORPEM_BASE_URL || 'http://webcorpem.no-ip.info:800/scripts/mh.dll/wc',
      cnpjWms: process.env.CORPEM_CNPJ_WMS || '', // CNPJ do cliente WMS sem máscara
      token: process.env.CORPEM_TOKEN || '6cnc3', // Token de autenticação
      tokenHeader: process.env.CORPEM_TOKEN_HEADER || 'TOKEN_CP', // Nome do header do token
      timeout: 30000 // 30 segundos
    };

    // Debug log to verify URL configuration
    console.log('🔧 CORPEM CONFIG DEBUG:');
    console.log('   process.env.CORPEM_BASE_URL:', process.env.CORPEM_BASE_URL);
    console.log('   this.config.baseURL:', this.config.baseURL);

    // Configurar axios instance com headers limpos
    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'TOKEN_CP': this.config.token || ''
      }
    });
  }

  /**
   * Registra um produto no WMS Corpem
   * Integração 01 - Cadastro de Mercadorias
   * 
   * @param {Object} scheduleData - Dados do agendamento
   * @returns {Promise<Object>} Resultado da integração
   */
  async registerProducts(scheduleData) {
    try {
      console.log(`Iniciando cadastro de produtos Corpem (ID: ${scheduleData.id})`);

      if (!scheduleData.client?.trim()) {
        return { success: false, message: 'CNPJ do estoque é obrigatório para integração com Corpem' };
      }

      const products = this.extractProductsFromSchedule(scheduleData);
      
      if (!products || products.length === 0) {
        return { success: false, message: 'Nenhum produto encontrado' };
      }

      const corpemProducts = products.map((product, index) => {
        return this.mapProductToCorpem(product, scheduleData);
      });

      const payload = {
        "CORPEM_ERP_MERC": {
          "CGCCLIWMS": scheduleData.client,
          "PRODUTOS": corpemProducts
        }
      };

      const startTime = Date.now();
      const response = await this.axiosInstance.post('', payload);

      this.logCorpemRequest('POST', this.config.baseURL, payload, response, startTime, 'products', scheduleData.id);

      if (response.data.CORPEM_WS_OK === "OK") {
        console.log(`Produtos cadastrados com sucesso no Corpem (ID: ${scheduleData.id})`);
        
        try {
          const dpSchedulerService = require('./dpSchedulerService');
          await dpSchedulerService.scheduleDP(scheduleData);
        } catch (dpError) {
          console.error(`Erro ao agendar busca de DP (ID: ${scheduleData.id}):`, dpError);
        }
        
        return { 
          success: true, 
          message: 'Produtos cadastrados com sucesso no Corpem WMS',
          data: response.data
        };
      } else {
        console.error(`Erro no cadastro de produtos Corpem (ID: ${scheduleData.id}): ${response.data.CORPEM_WS_ERRO}`);
        return { 
          success: false, 
          message: response.data.CORPEM_WS_ERRO || 'Erro desconhecido no Corpem',
          data: response.data
        };
      }

    } catch (error) {
      console.error(`Erro na integração de produtos Corpem (ID: ${scheduleData.id}): ${error.message}`);
      
      if (error.config) {
        const startTime = Date.now() - 30000;
        this.logCorpemRequest(
          error.config.method?.toUpperCase() || 'POST',
          error.config.url || this.config.baseURL,
          error.config.data ? JSON.parse(error.config.data) : {},
          error.response || null,
          startTime,
          'products',
          scheduleData.id
        );
      }
      
      return { 
        success: false, 
        message: `Erro na integração: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Integra NF de entrada no WMS Corpem
   * Integração 02 - NF de Entrada (DP de Entrada)
   * 
   * @param {Object} scheduleData - Dados do agendamento
   * @returns {Promise<Object>} Resultado da integração
   */
  async registerNfEntry(scheduleData) {
    try {
      console.log(`Iniciando integração NF de entrada Corpem (ID: ${scheduleData.id})`);

      if (!scheduleData.client?.trim()) {
        return { success: false, message: 'CNPJ do estoque é obrigatório' };
      }

      const nfeData = this.extractNfeDataFromSchedule(scheduleData);
      const products = this.extractProductsFromSchedule(scheduleData);
      const supplierCnpj = this.extractSupplierCnpj(scheduleData);

      if (!nfeData || !products?.length) {
        return { success: false, message: 'Dados da NFe/Produtos não encontrados' };
      }
      
      let info = scheduleData.info;
      if (typeof info === 'string') {
        info = JSON.parse(info);
      }

      const ide = info?.ide || {};
      const emit = info?.emit || {};
      
      const totalValue = nfeData.totalValue || this.calculateTotalValue(products);
      const formattedDate = this.formatDateToDDMMYYYY(ide.dhEmi || scheduleData.date);
      const cleanedCgcrem = this.extractSupplierCnpj(scheduleData);
      const numericNumnf = String(ide?.nNF || scheduleData.number).replace(/\D/g, '') || '123456';
      const serieNf = ide?.serie || '1';
      const validChavenf = scheduleData.nfe_key || scheduleData.chave_nfe || 
        `35${new Date().getFullYear().toString().substring(2)}${String(new Date().getMonth() + 1).padStart(2, '0')}${scheduleData.client}55001000000${numericNumnf.padStart(9, '0')}`;

      const corpemProducts = products.map((product, index) => {
        return this.mapProductToCorpemNfEntry(product, index + 1);
      });

      const payload = {
        "CORPEM_ERP_DOC_ENT": {
          "CGCCLIWMS": scheduleData.client,
          "CGCREM": cleanedCgcrem,
          "OBSRESDP": `N.F.: ${numericNumnf}`,
          "TPDESTNF": "2",
          "DEV": "0",
          "NUMNF": String(numericNumnf),
          "SERIENF": String(serieNf),
          "DTEMINF": formattedDate,
          "VLTOTALNF": String(totalValue),
          "NUMEPEDCLI": `N.F. ${numericNumnf}`,
          "CHAVENF": validChavenf,
          "CHAVENF_DEV": "",
          "ITENS": corpemProducts
        }
      };

      const startTime = Date.now();
      const response = await this.axiosInstance.post('', payload);

      if (response.data.CORPEM_WS_OK === "OK") {
        console.log(`NF integrada com sucesso no Corpem (ID: ${scheduleData.id})`);
        
        await this.integrateWithDpVerification(scheduleData, response.data);
        
        return { 
          success: true, 
          message: 'NF de entrada integrada com sucesso no Corpem WMS',
          data: response.data
        };
      } else {
        console.error(`Erro na integração NF Corpem (ID: ${scheduleData.id}): ${response.data.CORPEM_WS_ERRO}`);
        
        return { 
          success: false, 
          message: response.data.CORPEM_WS_ERRO || 'Erro desconhecido no Corpem',
          data: response.data
        };
      }

    } catch (error) {
      console.error(`Erro na integração NF Corpem (ID: ${scheduleData.id}): ${error.message}`);
      
      if (error.config) {
        const startTime = Date.now() - 30000;
        this.logCorpemRequest(
          error.config.method?.toUpperCase() || 'POST',
          error.config.url || this.config.baseURL,
          error.config.data ? JSON.parse(error.config.data) : {},
          error.response || null,
          startTime,
          'nf_entry',
          scheduleData.id
        );
      }
      
      return { 
        success: false, 
        message: `Erro na integração: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Extrai produtos do agendamento
   * @param {Object} scheduleData 
   * @returns {Array} Lista de produtos
   */
  extractProductsFromSchedule(scheduleData) {
    try {
      let products = [];

      // Tentar extrair do campo info.products
      if (scheduleData.info && scheduleData.info.products && Array.isArray(scheduleData.info.products)) {
        products = scheduleData.info.products;
      }
      // Fallback: se info for string, tentar parsear
      else if (scheduleData.info && typeof scheduleData.info === 'string') {
        const parsedInfo = JSON.parse(scheduleData.info);
        if (parsedInfo.products && Array.isArray(parsedInfo.products)) {
          products = parsedInfo.products;
        }
      }

      return products;

    } catch (error) {
      console.error('Erro ao extrair produtos:', error);
      return [];
    }
  }

  /**
   * Extrai dados da NFe do agendamento
   * @param {Object} scheduleData 
   * @returns {Object} Dados da NFe
   */
  extractNfeDataFromSchedule(scheduleData) {
    try {
      let info = scheduleData.info;
      
      if (typeof info === 'string') {
        info = JSON.parse(info);
      }

      // Extrair dados específicos da estrutura da NFe
      const nfeData = {
        serie: info.ide?.serie || "1",
        totalValue: info.total?.ICMSTot?.vNF || info.total?.ICMSTot?.vProd || null,
        emissionDate: info.ide?.dhEmi || scheduleData.date,
        supplierCnpj: this.extractSupplierCnpj(scheduleData),
        supplierName: info.emit?.xNome || scheduleData.supplier
      };

      return nfeData;

    } catch (error) {
      console.error('Erro ao extrair dados da NFe:', error);
      return null;
    }
  }

  /**
   * Mapeia produto para formato Corpem (Cadastro de Mercadorias)
   * @param {Object} product 
   * @param {Object} scheduleData 
   * @returns {Object} Produto no formato Corpem
   */
  mapProductToCorpem(product, scheduleData) {
    // Usar código de venda do usuário (client_code) - campo correto da aba Produtos da NFe
    const productCode = product.client_code || product.cli_code || product.supplier_code || product.code || `PROD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Usar descrição de venda do usuário (client_description) - campo correto da aba Produtos da NFe
    const productName = product.client_description || product.cli_desc || product.supplier_description || product.description || 'Produto sem descrição';

    return {
      "CODPROD": productCode,
      "NOMEPROD": productName.substring(0, 100), // Máximo 100 caracteres
      "IWS_ERP": "1",
      "TPOLRET": "1", // FIFO
      "IAUTODTVEN": "0",
      "QTDDPZOVEN": "",
      "ILOTFAB": "0",
      "IDTFAB": "0", 
      "IDTVEN": "0",
      "INSER": "0",
      "SEM_LOTE_CKO": "0",
      "SEM_DTVEN_CKO": "0",
      "CODFAB": product.supp_code || product.supplier_code || "",
      "NOMEFAB": (product.supp_desc || product.supplier_description || scheduleData.supplier || "").substring(0, 100),
      "CODGRU": "",
      "NOMEGRU": "",
      "CODPROD_FORN": product.supp_code || product.supplier_code || "",
      "NCM": (product.ncm || "").replace(/[^0-9]/g, '').padEnd(8, '0').substring(0, 8),
      "EMBALAGENS": [
        {
          "CODUNID": product.unit || "UN",
          "FATOR": "1",
          "CODBARRA": product.ean_code || "",
          "PESOLIQ": "",
          "PESOBRU": "",
          "ALT": "",
          "LAR": "",
          "COMP": "",
          "VOL": "",
          "IEMB_ENT": "1",
          "IEMB_SAI": "1"
        }
      ]
    };
  }

  /**
   * Mapeia produto para formato Corpem (NF de Entrada)
   * @param {Object} product 
   * @param {Number} sequence 
   * @returns {Object} Item no formato Corpem
   */
  mapProductToCorpemNfEntry(product, sequence) {
    // Usar código de venda do usuário (client_code) - campo correto da aba Produtos da NFe
    const productCode = product.client_code || product.cli_code || product.supplier_code || product.code || `PROD_${sequence}`;
    
    return {
      "NUMSEQ": String(sequence),
      "CODPROD": productCode,
      "QTPROD": String(product.quantity || 1),
      "VLTOTPROD": String(product.total_value || (product.unit_value * product.quantity) || 0),
      "NUMPED_COMPRA": "",
      "LOTFAB": "",
      "DTVEN": "",
      "NUMSEQ_DEV": ""
    };
  }

  /**
   * Extrai CNPJ do fornecedor
   * @param {Object} scheduleData 
   * @returns {String} CNPJ do fornecedor
   */
  extractSupplierCnpj(scheduleData) {
    try {
      let info = scheduleData.info;
      
      if (typeof info === 'string') {
        info = JSON.parse(info);
      }

      let supplierCnpj = info?.emit?.CNPJ || info?.emit?.cnpj || info?.supplier_cnpj || info?.CNPJ || info?.cnpj;
      
      if (supplierCnpj) {
        supplierCnpj = String(supplierCnpj).replace(/[^\d]/g, '');
        
        if (supplierCnpj.length === 14) {
          return supplierCnpj;
        }
      }
      
      return "99999999999999";

    } catch (error) {
      console.error('Erro ao extrair CNPJ do fornecedor:', error);
      return "99999999999999";
    }
  }

  /**
   * Calcula valor total dos produtos
   * @param {Array} products 
   * @returns {Number} Valor total
   */
  calculateTotalValue(products) {
    return products.reduce((total, product) => {
      return total + (product.total_value || (product.unit_value * product.quantity) || 0);
    }, 0);
  }

  /**
   * Formata data para formato DD/MM/YYYY
   * @param {String} dateString 
   * @returns {String} Data formatada
   */
  formatDateToDDMMYYYY(dateString) {
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return new Date().toLocaleDateString('pt-BR');
    }
  }

  /**
   * Logs detalhados das requisições HTTP para Corpem API
   * @param {String} method - Método HTTP
   * @param {String} url - URL da requisição
   * @param {Object} requestData - Dados da requisição
   * @param {Object} response - Resposta da API
   * @param {Number} startTime - Timestamp do início da requisição
   * @param {String} integrationType - Tipo de integração
   * @param {Number} scheduleId - ID do agendamento
   */
  logCorpemRequest(method, url, requestData, response = null, startTime, integrationType, scheduleId = null) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log(`🌐 CORPEM API REQUEST LOG - ${integrationType.toUpperCase()}`);
    console.log('='.repeat(80));
    
    // Informações básicas
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`⏱️  Duração: ${duration}ms`);
    if (scheduleId) console.log(`📋 Schedule ID: ${scheduleId}`);
    console.log(`🔧 Tipo de Integração: ${integrationType}`);
    
    // Request details
    console.log('\n📤 REQUEST DETAILS:');
    console.log(`   Método: ${method}`);
    console.log(`   URL: ${url}`);
    console.log('   Headers:');
    console.log('     Content-Type: application/json');
    console.log('     TOKEN_CP:', this.config.token ? `"${this.config.token}"` : '""');
    console.log(`   Payload:`);
    console.log(JSON.stringify(requestData, null, 2));
    
    // Response details
    if (response) {
      console.log('\n📥 RESPONSE DETAILS:');
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Headers: ${JSON.stringify(response.headers, null, 2)}`);
      console.log(`   Body:`);
      console.log(JSON.stringify(response.data, null, 2));
      
      // Status summary
      const isSuccess = response.data.CORPEM_WS_OK === "OK";
      console.log(`\n${isSuccess ? '✅' : '❌'} Status: ${isSuccess ? 'SUCESSO' : 'ERRO'}`);
      
      if (!isSuccess && response.data.CORPEM_WS_ERRO) {
        console.log(`🚨 Erro Corpem: ${response.data.CORPEM_WS_ERRO}`);
      }
    } else {
      console.log('\n❌ RESPONSE: Requisição falhou antes de receber resposta');
    }
    
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Verifica se as configurações estão válidas
   * @returns {Boolean} True se configurações válidas
   */
  isConfigValid() {
    const isValid = !!(this.config.baseURL);
    
    if (!isValid) {
      console.log('❌ Configuração Corpem inválida:');
      console.log('   Base URL:', this.config.baseURL || 'NÃO CONFIGURADO');
    }
    
    // Log de aviso sobre token
    if (!this.config.token || this.config.token.trim() === '') {
      console.log('⚠️ AVISO: Token Corpem não configurado - requisições podem falhar');
      console.log('   Configure CORPEM_TOKEN no arquivo .env');
    }
    
    return isValid;
  }

  /**
   * Integra com o serviço de verificação de DP após sucesso no Corpem
   * @param {Object} scheduleData - Dados do agendamento
   * @param {Object} corpemResponse - Resposta do Corpem
   * @returns {Promise<void>}
   */
  async integrateWithDpVerification(scheduleData, corpemResponse) {
    try {
      const DPVerificationServiceOptimized = require('./dpVerificationServiceOptimized');
      const dpService = new DPVerificationServiceOptimized();
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const nfNumber = scheduleData.number || scheduleData.nfe_key;
      const clientCnpj = scheduleData.client;
      let clientNumber = null;
      
      if (scheduleData.info) {
        let info = scheduleData.info;
        if (typeof info === 'string') {
          info = JSON.parse(info);
        }
        clientNumber = info.client_number || info.no_cli || null;
      }
      
      const dpResult = await dpService.getDPFromWtrTableOptimized(
        nfNumber, 
        clientCnpj, 
        clientNumber
      );
      
      if (dpResult) {
        console.log(`DP encontrado e atribuído ao agendamento ${scheduleData.id}: ${dpResult.dp_number}`);
        await dpService.updateScheduleDP(scheduleData.id, dpResult);
      } else {
        console.log(`DP não encontrado para agendamento ${scheduleData.id} - tentativa posterior agendada`);
        
        setTimeout(async () => {
          const laterDpResult = await dpService.getDPFromWtrTableOptimized(
            nfNumber, 
            clientCnpj, 
            clientNumber
          );
          
          if (laterDpResult) {
            console.log(`DP encontrado na segunda tentativa (ID: ${scheduleData.id}): ${laterDpResult.dp_number}`);
            await dpService.updateScheduleDP(scheduleData.id, laterDpResult);
          }
        }, 30000);
      }
      
    } catch (error) {
      console.error(`Erro na integração com verificação de DP (ID: ${scheduleData.id}):`, error.message);
    }
  }

  /**
   * Testa conectividade com Corpem
   * @returns {Promise<Object>} Resultado do teste
   */
  async testConnection() {
    try {
      if (!this.isConfigValid()) {
        return { 
          success: false, 
          message: 'Configurações do Corpem incompletas (CNPJ WMS ou URL)' 
        };
      }

      // Fazer uma consulta simples de estoque para testar conectividade
      // Para teste de conexão, usar o CNPJ padrão do WMS (ambiente)
      const payload = {
        "CORPEM_ERP_ESTOQUE": {
          "CGCCLIWMS": this.config.cnpjWms
        }
      };

      const startTime = Date.now();
      const response = await this.axiosInstance.post('', payload);

      // Log detalhado da requisição
      this.logCorpemRequest('POST', this.config.baseURL, payload, response, startTime, 'test_connection');

      if (response.data.CORPEM_WS_OK || response.data.CORPEM_ERP_ESTOQUE) {
        return { 
          success: true, 
          message: 'Conexão com Corpem WMS estabelecida com sucesso',
          data: response.data 
        };
      } else {
        return { 
          success: false, 
          message: response.data.CORPEM_WS_ERRO || 'Erro na conexão com Corpem',
          data: response.data 
        };
      }

    } catch (error) {
      console.error('Erro ao testar conexão com Corpem:', error);
      
      // Log da requisição com erro
      if (error.config) {
        const startTime = Date.now() - 30000; // Aproximação para mostrar que houve erro
        this.logCorpemRequest(
          error.config.method?.toUpperCase() || 'POST',
          error.config.url || this.config.baseURL,
          error.config.data ? JSON.parse(error.config.data) : {},
          error.response || null,
          startTime,
          'test_connection'
        );
      }
      
      return { 
        success: false, 
        message: `Erro na conexão: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }
}

module.exports = new CorpemIntegrationService();