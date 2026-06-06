export enum StorageKey {
  CONTACTS = 'saio_contacts',
  COMPANIES = 'saio_companies',
  DEALS = 'saio_deals',
  PIPELINES = 'saio_pipelines',
  TASKS = 'saio_tasks',
  PROJECTS = 'saio_projects',
  EVENTS = 'saio_events',
  BOOKING_PAGES = 'saio_booking_pages',
  EMAIL_CAMPAIGNS = 'saio_email_campaigns',
  SMS_CAMPAIGNS = 'saio_sms_campaigns',
  FORMS = 'saio_forms',
  FORM_RESPONSES = 'saio_form_responses',
  LANDING_PAGES = 'saio_landing_pages',
  AUTOMATIONS = 'saio_automations',
  SOCIAL_POSTS = 'saio_social_posts',
  SEGMENTS = 'saio_segments',
  NOTIFICATIONS = 'saio_notifications',
  ACTIVITY_LOG = 'saio_activity_log',
  TAGS = 'saio_tags',
  CUSTOM_FIELDS = 'saio_custom_fields',
  SETTINGS = 'saio_settings',
  TEAM_MEMBERS = 'saio_team_members',
  CANNED_RESPONSES = 'saio_canned_responses'
}

export const db = {
  async get<T>(key: StorageKey): Promise<T[]> {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  async set<T>(key: StorageKey, data: T[]): Promise<void> {
    localStorage.setItem(key, JSON.stringify(data));
  },

  async findById<T extends { id: string }>(key: StorageKey, id: string): Promise<T | null> {
    const items = await this.get<T>(key);
    return items.find((item) => item.id === id) || null;
  },

  async insert<T extends { id?: string; createdAt?: string; updatedAt?: string }>(
    key: StorageKey,
    item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<T> {
    const items = await this.get<T>(key);
    const now = new Date().toISOString();
    const newItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as T;
    items.push(newItem);
    await this.set(key, items);
    return newItem;
  },

  async update<T extends { id: string; updatedAt?: string }>(
    key: StorageKey,
    id: string,
    changes: Partial<T>
  ): Promise<T> {
    const items = await this.get<T>(key);
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new Error(`Item ${id} not found in ${key}`);

    const updatedItem = {
      ...items[index],
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    items[index] = updatedItem;
    await this.set(key, items);
    return updatedItem;
  },

  async delete(key: StorageKey, id: string): Promise<void> {
    const items = await this.get<{ id: string }>(key);
    const filtered = items.filter((item) => item.id !== id);
    await this.set(key, filtered);
  },

  async query<T>(key: StorageKey, predicate: (item: T) => boolean): Promise<T[]> {
    const items = await this.get<T>(key);
    return items.filter(predicate);
  },

  async count(key: StorageKey): Promise<number> {
    const items = await this.get<{ id: string }>(key);
    return items.length;
  }
};
