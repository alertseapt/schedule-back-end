const { executeCheckinQuery } = require('../config/database');

/**
 * Serviço para gerenciar produtos no banco de dados
 * Permite pré-preenchimento automático baseado em supp_code + supp_cnpj
 */
class ProductService {
  
  /**
   * Salva produtos de um agendamento no banco para futura referência
   * @param {Array} products - Lista de produtos com as informações da NFe
   * @param {Object} scheduleData - Dados do agendamento
   * @param {String} user - Usuário que está criando o agendamento
   * @returns {Promise<Object>} Resultado da operação
   */
  async saveProductsFromSchedule(products, scheduleData, user) {
    try {
      console.log(`🗃️ Salvando ${products.length} produtos no banco`);
      
      // Verificar se tabela existe
      try {
        await executeCheckinQuery('SELECT 1 FROM products LIMIT 1');
      } catch (tableError) {
        if (tableError.code === 'ER_NO_SUCH_TABLE') {
          console.log('❌ TABELA PRODUCTS NÃO EXISTE!');
          return {
            success: false,
            message: 'Tabela products não existe.',
            error: tableError
          };
        }
      }

      let savedCount = 0;
      let skippedCount = 0;
      const errors = [];

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        try {
          const suppCode = product.supp_code || product.supplier_code || product.code;
          const suppDesc = (product.supp_desc || product.supplier_description || product.description || 'Sem descrição').substring(0, 50); // Limitar a 50 chars
          const suppCnpj = this.extractSupplierCnpj(scheduleData);
          const cliCode = product.client_code || product.cli_code || suppCode;
          const cliDesc = (product.client_description || product.cli_desc || suppDesc).substring(0, 50); // Limitar a 50 chars
          const cliCnpj = scheduleData.client;

          if (!suppCode || !suppCnpj || !cliCode || !cliCnpj) {
            console.log(`❌ Produto ${i+1}: Dados obrigatórios ausentes`);
            console.log(`   supp_code: ${suppCode}`);
            console.log(`   supp_cnpj: ${suppCnpj}`);
            console.log(`   cli_code: ${cliCode}`);
            console.log(`   cli_cnpj: ${cliCnpj}`);
            continue;
          }

          const existingProduct = await this.findProductBySupplierAndClient(suppCode, suppCnpj, cliCnpj);
          
          if (existingProduct) {
            // Produto já existe - atualizar dados
            await executeCheckinQuery(
              `UPDATE products SET 
                 supp_desc = ?, cli_desc = ?, user = ?, date = NOW()
               WHERE supp_code = ? AND supp_cnpj = ? AND cli_cnpj = ?`,
              [suppDesc, cliDesc, user, suppCode, suppCnpj, cliCnpj]
            );
            console.log(`⚠️ Produto ${suppCode} atualizado`);
            skippedCount++;
          } else {
            // Inserir novo produto usando estrutura existente
            await executeCheckinQuery(
              `INSERT INTO products 
                 (cli_code, cli_cnpj, cli_desc, supp_code, supp_cnpj, supp_desc, user, date)
               VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
              [cliCode, cliCnpj, cliDesc, suppCode, suppCnpj, suppDesc, user]
            );
            console.log(`✅ Produto ${suppCode} inserido com sucesso`);
            savedCount++;
          }

        } catch (productError) {
          const productCode = product.supp_code || product.supplier_code || product.code || `produto-${i+1}`;
          console.error(`❌ ERRO ${productCode}:`, productError.message);
          errors.push({
            product: productCode,
            error: productError.message
          });
        }
      }

      console.log(`📊 FINAL: ${savedCount} salvos, ${skippedCount} atualizados, ${errors.length} erros`);

      return {
        success: errors.length < products.length,
        savedCount,
        skippedCount,
        errors,
        message: `${savedCount} produtos salvos, ${skippedCount} atualizados, ${errors.length} erros`
      };

    } catch (error) {
      console.error('❌ ERRO GERAL ao salvar produtos:', error.message);
      return {
        success: false,
        message: `Erro ao salvar produtos: ${error.message}`,
        error
      };
    }
  }

  /**
   * Busca produto existente baseado em supp_code, supp_cnpj e cli_cnpj
   * @param {String} suppCode - Código do produto do fornecedor
   * @param {String} suppCnpj - CNPJ do fornecedor
   * @param {String} cliCnpj - CNPJ do cliente/estoque
   * @returns {Promise<Object|null>} Produto encontrado ou null
   */
  async findProductBySupplierAndClient(suppCode, suppCnpj, cliCnpj) {
    try {
      console.log(`🔍 Query específica: suppCode=${suppCode}, suppCnpj=${suppCnpj}, cliCnpj=${cliCnpj}`);
      
      const products = await executeCheckinQuery(
        `SELECT * FROM products 
         WHERE supp_code = ? AND supp_cnpj = ? AND cli_cnpj = ?
         ORDER BY date DESC
         LIMIT 1`,
        [suppCode, suppCnpj, cliCnpj]
      );

      console.log(`   Resultados encontrados: ${products.length}`);
      if (products.length > 0) {
        console.log(`   Produto encontrado:`, {
          supp_code: products[0].supp_code,
          supp_cnpj: products[0].supp_cnpj,
          cli_cnpj: products[0].cli_cnpj,
          cli_code: products[0].cli_code,
          cli_desc: products[0].cli_desc
        });
      }

      return products.length > 0 ? products[0] : null;

    } catch (error) {
      console.error('❌ Erro ao buscar produto no banco:', error);
      return null;
    }
  }

  /**
   * Busca produtos existentes baseado apenas em supp_code e supp_cnpj
   * @param {String} suppCode - Código do produto do fornecedor
   * @param {String} suppCnpj - CNPJ do fornecedor
   * @returns {Promise<Array>} Lista de produtos encontrados
   */
  async findProductsBySupplier(suppCode, suppCnpj) {
    try {
      console.log(`🔍 Query geral: suppCode=${suppCode}, suppCnpj=${suppCnpj}`);
      
      const products = await executeCheckinQuery(
        `SELECT * FROM products 
         WHERE supp_code = ? AND supp_cnpj = ?
         ORDER BY date DESC`,
        [suppCode, suppCnpj]
      );

      console.log(`   Produtos encontrados para qualquer estoque: ${products.length}`);
      if (products.length > 0) {
        products.forEach((product, index) => {
          console.log(`   Produto ${index + 1}:`, {
            supp_code: product.supp_code,
            supp_cnpj: product.supp_cnpj,
            cli_cnpj: product.cli_cnpj,
            cli_code: product.cli_code
          });
        });
      }

      return products;

    } catch (error) {
      console.error('❌ Erro ao buscar produtos do fornecedor:', error);
      return [];
    }
  }

  /**
   * Retorna dados de preenchimento para um produto baseado no histórico
   * @param {String} suppCode - Código do produto do fornecedor
   * @param {String} suppCnpj - CNPJ do fornecedor
   * @param {String} cliCnpj - CNPJ do cliente/estoque (opcional)
   * @returns {Promise<Object|null>} Dados para pré-preenchimento
   */
  async getProductPrefillData(suppCode, suppCnpj, cliCnpj = null) {
    try {
      console.log(`🔍 Buscando prefill: ${suppCode} | Fornecedor: ${suppCnpj} | Cliente: ${cliCnpj}`);
      
      let product;
      let isSpecificClient = false; // Flag para saber se é específico do cliente

      if (cliCnpj) {
        product = await this.findProductBySupplierAndClient(suppCode, suppCnpj, cliCnpj);
        console.log(`🔍 Produto encontrado:`, !!product);
        if (product) {
          isSpecificClient = true;
          console.log(`✅ isSpecificClient = true para ${suppCode}`);
        } else {
          console.log(`❌ Produto não encontrado para cliente específico: ${suppCode}`);
        }
      }

      if (product) {
        console.log(`📝 Construindo resultado para ${suppCode} - isSpecificClient: ${isSpecificClient}`);
        
        const result = {
          cli_code: product.cli_code,
          cli_desc: product.cli_desc,
          source: isSpecificClient ? 'specific_client' : 'generic_supplier',
          is_locked: isSpecificClient // Bloquear apenas quando encontrado para cliente específico
        };
        
        console.log(`🔒 Produto ${suppCode} - is_locked: ${result.is_locked} (source: ${result.source})`);
        console.log(`📦 Resultado completo:`, result);
        return result;
      } else {
        // Se a triangulação exata não for encontrada, retorna campos vazios
        console.log(`❌ Produto ${suppCode} - não encontrado para triangulação`);
        return {
          cli_code: '',
          cli_desc: '',
          source: 'not_found',
          is_locked: false // Não bloquear quando não encontrado
        };
      }

    } catch (error) {
      console.error('❌ Erro ao buscar dados de preenchimento:', error);
      return null;
    }
  }

  /**
   * Extrai CNPJ do fornecedor dos dados do agendamento
   * @param {Object} scheduleData - Dados do agendamento
   * @returns {String} CNPJ do fornecedor
   */
  extractSupplierCnpj(scheduleData) {
    try {
      console.log('🔍 DEBUG extractSupplierCnpj:');
      console.log('   scheduleData.info type:', typeof scheduleData.info);
      
      let info = scheduleData.info;
      
      if (typeof info === 'string') {
        info = JSON.parse(info);
        console.log('   info parseado de string');
      }

      console.log('   info existe:', !!info);
      console.log('   info.emit existe:', !!info?.emit);
      console.log('   info.emit.CNPJ:', info?.emit?.CNPJ);

      // Tentar diferentes formas de acessar o CNPJ
      let supplierCnpj = info?.emit?.CNPJ || info?.emit?.cnpj || info?.supplier_cnpj || info?.CNPJ || info?.cnpj;
      
      console.log('   CNPJ bruto extraído:', supplierCnpj);
      console.log('   info.supplier_cnpj:', info?.supplier_cnpj);
      
      // Limpar CNPJ (remover máscaras)
      if (supplierCnpj) {
        supplierCnpj = String(supplierCnpj).replace(/[^\d]/g, '');
        console.log('   CNPJ limpo:', supplierCnpj, 'length:', supplierCnpj.length);
        
        if (supplierCnpj.length === 14) {
          console.log(`✅ CNPJ do fornecedor extraído: ${supplierCnpj}`);
          return supplierCnpj;
        }
      }
      
      // Debug: mostrar estrutura do objeto info
      console.log('   Estrutura do info:');
      if (info && typeof info === 'object') {
        console.log('   Chaves principais:', Object.keys(info));
        if (info.emit) {
          console.log('   Chaves do emit:', Object.keys(info.emit));
        }
      }
      
      console.log(`⚠️ CNPJ do fornecedor não encontrado ou inválido, usando padrão`);
      return "99999999999999"; // CNPJ padrão se não encontrar

    } catch (error) {
      console.error('❌ Erro ao extrair CNPJ do fornecedor:', error);
      return "99999999999999";
    }
  }

  /**
   * Lista produtos cadastrados com filtros
   * @param {Object} filters - Filtros de busca
   * @returns {Promise<Array>} Lista de produtos
   */
  async listProducts(filters = {}) {
    try {
      let query = 'SELECT * FROM products WHERE 1=1';
      const params = [];

      if (filters.supp_cnpj) {
        query += ' AND supp_cnpj = ?';
        params.push(filters.supp_cnpj);
      }

      if (filters.cli_cnpj) {
        query += ' AND cli_cnpj = ?';
        params.push(filters.cli_cnpj);
      }

      if (filters.supp_code) {
        query += ' AND supp_code LIKE ?';
        params.push(`%${filters.supp_code}%`);
      }

      if (filters.cli_code) {
        query += ' AND cli_code LIKE ?';
        params.push(`%${filters.cli_code}%`);
      }

      query += ' ORDER BY date DESC';

      if (filters.limit) {
        query += ` LIMIT ${parseInt(filters.limit)}`;
      }

      const products = await executeCheckinQuery(query, params);
      return products;

    } catch (error) {
      console.error('❌ Erro ao listar produtos:', error);
      return [];
    }
  }
}

module.exports = new ProductService();