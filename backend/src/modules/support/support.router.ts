import { Router } from 'express';
import { supportController } from './support.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';

export const supportRouter = Router();

// Public / Authenticated Help Center Articles
supportRouter.get('/articles', supportController.getArticles);

// Authenticated Support Ticket Operations
supportRouter.use(authenticate);

supportRouter.post('/tickets', supportController.createTicket);
supportRouter.get('/tickets', supportController.listTickets);
supportRouter.get('/tickets/:id', supportController.getTicketById);
supportRouter.post('/tickets/:id/replies', supportController.addReply);
supportRouter.patch('/tickets/:id/status', supportController.updateStatus);
supportRouter.patch('/tickets/:id/assign', authorizeRoles('SUPER_ADMIN'), supportController.assignTicket);

// Customer Success & Feedback Operations
supportRouter.post('/feedback', supportController.recordFeedback);
supportRouter.get('/feedback', supportController.listFeedback);
supportRouter.get('/customer-success/health', supportController.getTenantHealth);
supportRouter.get('/customer-success/portfolio', authorizeRoles('SUPER_ADMIN'), supportController.getPortfolioHealth);
