import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crmService from '../crm.service';

// Mock the database client
vi.mock('../../../infrastructure/database/client.js', () => {
  return {
    db: {
      contact: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      deal: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      activity: {
        create: vi.fn(),
      },
      pipelineStage: {
        findFirst: vi.fn(),
      }
    }
  };
});

import { db } from '../../../infrastructure/database/client.js';

describe('CRM Service', () => {
  const mockWorkspaceId = 'workspace-123';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createContact', () => {
    it('creates a new contact successfully', async () => {
      const mockContactData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      const expectedResponse = {
        id: 'contact-1',
        ...mockContactData,
        workspaceId: mockWorkspaceId
      };

      (db.contact.create as any).mockResolvedValue(expectedResponse);

      const result = await crmService.createContact(mockWorkspaceId, mockContactData);

      expect(db.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ...mockContactData,
            workspaceId: mockWorkspaceId
          })
        })
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('createDeal', () => {
    it('creates a deal with the proper pipeline stage', async () => {
      const mockDealData = {
        title: 'Enterprise License',
        amount: 50000,
        pipelineStageId: 'stage-1'
      };

      const expectedDeal = {
        id: 'deal-1',
        ...mockDealData,
        workspaceId: mockWorkspaceId,
        createdBy: 'user-1'
      };

      (db.deal.create as any).mockResolvedValue(expectedDeal);
      (db.pipelineStage.findFirst as any).mockResolvedValue({ probability: 75 });

      const result = await crmService.createDeal(mockWorkspaceId, 'user-1', mockDealData as any);

      expect(db.deal.create).toHaveBeenCalled();
      expect(result).toEqual(expectedDeal);
    });
  });
});
