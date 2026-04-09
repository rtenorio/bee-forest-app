import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bee Forest API',
      version: '1.0.0',
      description:
        'API de gestão de meliponicultura. Controla meliponários, caixas de abelha, ' +
        'inspeções, orientações/tarefas com SLA, colheitas, estoque e usuários. ' +
        'Autenticação via JWT Bearer token.',
    },
    servers: [
      {
        url: 'https://bee-forest-app-production.up.railway.app',
        description: 'Produção (Railway)',
      },
      {
        url: 'http://localhost:3001',
        description: 'Desenvolvimento local',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT obtido via POST /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Mensagem de erro' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:               { type: 'integer', example: 1 },
            name:             { type: 'string',  example: 'João Silva' },
            email:            { type: 'string',  format: 'email', example: 'joao@beeforest.com' },
            role:             { type: 'string',  enum: ['master_admin', 'socio', 'orientador', 'responsavel', 'tratador'] },
            apiary_local_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
            hive_local_ids:   { type: 'array', items: { type: 'string', format: 'uuid' } },
          },
        },
        Apiary: {
          type: 'object',
          properties: {
            local_id:   { type: 'string', format: 'uuid' },
            name:       { type: 'string', example: 'Meliponário Serra Verde' },
            location:   { type: 'string', example: 'Fazenda Boa Vista, Zona Rural' },
            latitude:   { type: 'number', format: 'double', nullable: true },
            longitude:  { type: 'number', format: 'double', nullable: true },
            owner_name: { type: 'string', nullable: true },
            notes:      { type: 'string', nullable: true },
            status:     { type: 'string', enum: ['active', 'inactive', 'implantacao'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Hive: {
          type: 'object',
          properties: {
            local_id:          { type: 'string', format: 'uuid' },
            apiary_local_id:   { type: 'string', format: 'uuid' },
            code:              { type: 'string', example: 'CME-001-SRV' },
            status:            { type: 'string', enum: ['active', 'inactive', 'dead', 'transferred'] },
            box_type:          { type: 'string', example: 'INPA' },
            species_local_id:  { type: 'string', format: 'uuid', nullable: true },
            species_name:      { type: 'string', nullable: true },
            installation_date: { type: 'string', format: 'date', nullable: true },
            notes:             { type: 'string', nullable: true },
            created_at:        { type: 'string', format: 'date-time' },
          },
        },
        Inspection: {
          type: 'object',
          properties: {
            local_id:       { type: 'string', format: 'uuid' },
            hive_local_id:  { type: 'string', format: 'uuid' },
            inspected_at:   { type: 'string', format: 'date-time' },
            inspector_name: { type: 'string' },
            notes:          { type: 'string', nullable: true },
            checklist:      { type: 'object', description: 'Checklist completo da inspeção' },
            created_at:     { type: 'string', format: 'date-time' },
          },
        },
        Instruction: {
          type: 'object',
          properties: {
            local_id:         { type: 'string', format: 'uuid' },
            apiary_local_id:  { type: 'string', format: 'uuid' },
            hive_local_id:    { type: 'string', format: 'uuid', nullable: true },
            author_id:        { type: 'integer' },
            author_name:      { type: 'string' },
            text_content:     { type: 'string', nullable: true },
            audio_key:        { type: 'string', nullable: true },
            status:           { type: 'string', enum: ['pendente', 'em_execucao', 'concluida', 'validada', 'rejeitada'] },
            priority_days:    { type: 'integer', nullable: true, description: 'null = urgente, número = dias até vencer' },
            due_date:         { type: 'string', format: 'date', nullable: true },
            prazo_conclusao:  { type: 'string', format: 'date-time', nullable: true },
            evidencia_key:    { type: 'string', nullable: true },
            validado_por:     { type: 'integer', nullable: true },
            validado_em:      { type: 'string', format: 'date-time', nullable: true },
            motivo_rejeicao:  { type: 'string', nullable: true },
            created_at:       { type: 'string', format: 'date-time' },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id:             { type: 'integer' },
            user_id:        { type: 'integer', nullable: true },
            user_name:      { type: 'string', nullable: true },
            user_role:      { type: 'string', nullable: true },
            action:         { type: 'string', enum: ['CREATE', 'UPDATE', 'DELETE'] },
            resource_type:  { type: 'string', example: 'instruction' },
            resource_id:    { type: 'string', nullable: true },
            resource_label: { type: 'string', nullable: true },
            payload:        { type: 'object', nullable: true },
            ip_address:     { type: 'string', nullable: true },
            timestamp:      { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'auth',         description: 'Autenticação e sessão do usuário' },
      { name: 'apiaries',     description: 'Meliponários (apiários)' },
      { name: 'hives',        description: 'Caixas de abelha (colmeias)' },
      { name: 'inspections',  description: 'Inspeções de colmeias' },
      { name: 'instructions', description: 'Orientações e tarefas com SLA' },
      { name: 'users',        description: 'Gerenciamento de usuários' },
      { name: 'admin',        description: 'Endpoints administrativos (master_admin)' },
    ],
  },
  apis: [
    path.join(__dirname, 'routes', '*.ts'),
    path.join(__dirname, 'routes', '*.js'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
