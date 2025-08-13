const Joi = require('joi');

// Função de validação genérica
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'params' ? req.params : 
                 source === 'query' ? req.query : req.body;
    
    const { error } = schema.validate(data, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      console.log('❌ Erro de validação:', errors);
      
      return res.status(400).json({
        error: 'Dados inválidos',
        details: errors
      });
    }
    
    next();
  };
};

// Schemas para parâmetros
const paramSchemas = {
  id: Joi.object({
    id: Joi.number().integer().positive().required()
  }),
  
  cnpj: Joi.object({
    cnpj: Joi.string().length(14).pattern(/^[0-9]+$/).required()
  }),
  
  clientCnpj: Joi.object({
    cli_cnpj: Joi.string().length(14).pattern(/^[0-9]+$/).required()
  }),
  
  supplierCnpj: Joi.object({
    supp_cnpj: Joi.string().length(14).pattern(/^[0-9]+$/).required()
  }),
  
  productParams: Joi.object({
    cli_code: Joi.string().max(50).required(),
    cli_cnpj: Joi.string().length(14).pattern(/^[0-9]+$/).required(),
    supp_code: Joi.string().max(50).required(),
    supp_cnpj: Joi.string().length(14).pattern(/^[0-9]+$/).required()
  })
};

// Schemas específicos para NFe e XML
const nfeSchemas = {
  uploadXML: Joi.object({
    // Validação será feita no multer e no processamento do XML
  }),
  
  createWithProducts: Joi.object({
    nfe_data: Joi.object({
      number: Joi.string().required(),
      nfe_key: Joi.string().max(44).required(),
      client_cnpj: Joi.string().length(14).pattern(/^[0-9]+$/).required(),
      supplier_cnpj: Joi.string().length(14).pattern(/^[0-9]+$/).required(),
      supplier_name: Joi.string().max(100).required(),
      case_count: Joi.number().integer().min(0).required(),
      date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
      qt_prod: Joi.number().integer().min(0).optional(),
      stock_location: Joi.string().max(100).allow('', null).optional(),
      products: Joi.array().items(Joi.object({
        supp_code: Joi.string().max(50).required(),
        description: Joi.string().max(100).required(),
        quantity: Joi.number().min(0).required(),
        unit_value: Joi.number().min(0).required(),
        cli_code: Joi.string().max(50).allow(''),
        latest_into_case: Joi.number().integer().min(1).default(1)
      })).min(1).required()
    }).required()
  }),
  
  checkIntegration: Joi.object({
    products: Joi.array().items(Joi.object({
      supp_code: Joi.string().max(50).required(),
      supp_cnpj: Joi.string().length(14).pattern(/^[0-9]+$/).required(),
      cli_cnpj: Joi.string().length(14).pattern(/^[0-9]+$/).required()
    })).min(1).required()
  }),
  
  updateDescription: Joi.object({
    cli_code: Joi.string().max(50).required(),
    cli_cnpj: Joi.string().length(14).pattern(/^[0-9]+$/).required(),
    supp_code: Joi.string().max(50).required(),
    supp_cnpj: Joi.string().length(14).pattern(/^[0-9]+$/).required(),
    new_description: Joi.string().max(100).required(),
    comment: Joi.string().max(255).allow('')
  }),
  
  updateStatus: Joi.object({
    status: Joi.string().max(20).valid('Solicitado', 'Contestado', 'Agendado', 'Conferência', 'Tratativa', 'Estoque', 'Recusar', 'Cancelar', 'Recusado', 'Cancelado').required(),
    historic_entry: Joi.object().keys({
      timestamp: Joi.date().iso().default(new Date()),
      user: Joi.string().max(50).required(),
      action: Joi.string().max(100).required(),
      comment: Joi.string().max(255).allow(''),
      previous_status: Joi.string().max(20),
      new_status: Joi.string().max(20)
    }).required()
  })
};

// Função para validar CNPJ
const validateCNPJ = (cnpj) => {
  // Remove caracteres não numéricos
  cnpj = cnpj.replace(/[^\d]/g, '');
  
  // Verifica se tem 14 dígitos
  if (cnpj.length !== 14) return false;
  
  // Verifica se não são todos os dígitos iguais
  if (/^(\d)\1+$/.test(cnpj)) return false;
  
  // Valida primeiro dígito verificador
  let sum = 0;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i]) * weights1[i];
  }
  
  let remainder = sum % 11;
  let digit1 = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cnpj[12]) !== digit1) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i]) * weights2[i];
  }
  
  remainder = sum % 11;
  let digit2 = remainder < 2 ? 0 : 11 - remainder;
  
  return parseInt(cnpj[13]) === digit2;
};

// Função para formatar CNPJ
const formatCNPJ = (cnpj) => {
  cnpj = cnpj.replace(/[^\d]/g, '');
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

// Middleware para validar CNPJ
const validateCNPJMiddleware = (field = 'cnpj') => {
  return (req, res, next) => {
    const cnpj = req.body[field] || req.params[field] || req.query[field];
    
    if (!cnpj) {
      return res.status(400).json({
        error: `Campo ${field} é obrigatório`
      });
    }
    
    if (!validateCNPJ(cnpj)) {
      return res.status(400).json({
        error: `CNPJ inválido: ${cnpj}`
      });
    }
    
    next();
  };
};

module.exports = {
  validate,
  paramSchemas,
  nfeSchemas,
  validateCNPJ,
  formatCNPJ,
  validateCNPJMiddleware
}; 