import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  businessName: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  color: string;
}

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export type ViewMode = 'table' | 'card' | 'kanban';

export interface SmartList {
  id: string;
  name: string;
  contacts: Contact[];
  filters: FilterCondition[];
  matchMode: 'all' | 'any';
  viewMode: ViewMode;
  columns: string[];
  created: string;
  author: string;
}

// ── Store ──────────────────────────────────────────────────────────────────

interface SmartListStore {
  lists: SmartList[];
  createList: (list: Omit<SmartList, 'id' | 'created'>) => string;
  updateList: (id: string, patch: Partial<SmartList>) => void;
  deleteList: (id: string) => void;
  addContact: (listId: string, contact: Contact) => void;
  removeContact: (listId: string, contactId: string) => void;
}

const DEFAULT_COLUMNS = ['Contact name', 'Phone', 'Email', 'Business name', 'Created (EDT)', 'Tags'];

export const useSmartListStore = create<SmartListStore>()(
  persist(
    (set) => ({
      lists: [],

      createList: (list) => {
        const id = `sl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newList: SmartList = {
          ...list,
          id,
          created: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          columns: list.columns?.length ? list.columns : DEFAULT_COLUMNS,
        };
        set(state => ({ lists: [...state.lists, newList] }));
        return id;
      },

      updateList: (id, patch) => {
        set(state => ({
          lists: state.lists.map(l => l.id === id ? { ...l, ...patch } : l),
        }));
      },

      deleteList: (id) => {
        set(state => ({ lists: state.lists.filter(l => l.id !== id) }));
      },

      addContact: (listId, contact) => {
        set(state => ({
          lists: state.lists.map(l =>
            l.id === listId && !l.contacts.some(c => c.id === contact.id)
              ? { ...l, contacts: [...l.contacts, contact] }
              : l
          ),
        }));
      },

      removeContact: (listId, contactId) => {
        set(state => ({
          lists: state.lists.map(l =>
            l.id === listId
              ? { ...l, contacts: l.contacts.filter(c => c.id !== contactId) }
              : l
          ),
        }));
      },
    }),
    {
      name: 'crm-smart-lists',
    }
  )
);
