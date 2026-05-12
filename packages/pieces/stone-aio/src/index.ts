import { createPiece, PieceCategory } from '@activepieces/pieces-framework';
import { stoneAIOAuth } from './lib/common';
import { createLead } from './lib/actions/create-lead';
import { newLeadTrigger } from './lib/triggers/new-lead';

export const stoneAIO = createPiece({
  displayName: 'Stone AIO',
  logoUrl: 'https://raw.githubusercontent.com/activepieces/activepieces/main/docs/static/img/logo.png',
  authors: ['StoneAIO'],
  auth: stoneAIOAuth,
  categories: [PieceCategory.CRM],
  minimumSupportedRelease: '0.30.0',
  actions: [createLead],
  triggers: [newLeadTrigger],
});
