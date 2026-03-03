import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // --- Authors ---
  await db.run(sql`CREATE TABLE \`authors\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`bio\` text,
    \`avatar_id\` integer,
    \`social_links_twitter\` text,
    \`social_links_linkedin\` text,
    \`social_links_website\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`avatar_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE UNIQUE INDEX \`authors_slug_idx\` ON \`authors\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`authors_avatar_idx\` ON \`authors\` (\`avatar_id\`);`)
  await db.run(sql`CREATE INDEX \`authors_updated_at_idx\` ON \`authors\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`authors_created_at_idx\` ON \`authors\` (\`created_at\`);`)

  // --- Categories ---
  await db.run(sql`CREATE TABLE \`categories\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`description\` text,
    \`image_id\` integer,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE UNIQUE INDEX \`categories_slug_idx\` ON \`categories\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`categories_image_idx\` ON \`categories\` (\`image_id\`);`)
  await db.run(sql`CREATE INDEX \`categories_updated_at_idx\` ON \`categories\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`categories_created_at_idx\` ON \`categories\` (\`created_at\`);`)

  // --- Posts ---
  await db.run(sql`CREATE TABLE \`posts\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`title\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`content\` text,
    \`excerpt\` text,
    \`featured_image_id\` integer,
    \`author_id\` integer,
    \`featured\` integer DEFAULT 0,
    \`published_at\` text,
    \`reading_time\` numeric,
    \`meta_title\` text,
    \`meta_description\` text,
    \`meta_image_id\` integer,
    \`_status\` text DEFAULT 'draft',
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`featured_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`author_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_slug_idx\` ON \`posts\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`posts_featured_image_idx\` ON \`posts\` (\`featured_image_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_author_idx\` ON \`posts\` (\`author_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_meta_image_idx\` ON \`posts\` (\`meta_image_id\`);`)
  await db.run(sql`CREATE INDEX \`posts__status_idx\` ON \`posts\` (\`_status\`);`)
  await db.run(sql`CREATE INDEX \`posts_updated_at_idx\` ON \`posts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`posts_created_at_idx\` ON \`posts\` (\`created_at\`);`)

  // --- Posts rels (for hasMany categories relationship) ---
  await db.run(sql`CREATE TABLE \`posts_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`categories_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`posts_rels_order_idx\` ON \`posts_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_parent_idx\` ON \`posts_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_path_idx\` ON \`posts_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_categories_id_idx\` ON \`posts_rels\` (\`categories_id\`);`)

  // --- Posts versions (for drafts) ---
  await db.run(sql`CREATE TABLE \`_posts_v\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`parent_id\` integer,
    \`version_title\` text NOT NULL,
    \`version_slug\` text NOT NULL,
    \`version_content\` text,
    \`version_excerpt\` text,
    \`version_featured_image_id\` integer,
    \`version_author_id\` integer,
    \`version_featured\` integer DEFAULT 0,
    \`version_published_at\` text,
    \`version_reading_time\` numeric,
    \`version_meta_title\` text,
    \`version_meta_description\` text,
    \`version_meta_image_id\` integer,
    \`version__status\` text DEFAULT 'draft',
    \`version_updated_at\` text,
    \`version_created_at\` text,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`latest\` integer,
    \`autosave\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`version_featured_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`version_author_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE INDEX \`_posts_v_parent_idx\` ON \`_posts_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_slug_idx\` ON \`_posts_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_featured_image_idx\` ON \`_posts_v\` (\`version_featured_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_author_idx\` ON \`_posts_v\` (\`version_author_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_meta_image_idx\` ON \`_posts_v\` (\`version_meta_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version__status_idx\` ON \`_posts_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_created_at_idx\` ON \`_posts_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_updated_at_idx\` ON \`_posts_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_latest_idx\` ON \`_posts_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_autosave_idx\` ON \`_posts_v\` (\`autosave\`);`)

  // --- Posts versions rels ---
  await db.run(sql`CREATE TABLE \`_posts_v_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`categories_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`_posts_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_order_idx\` ON \`_posts_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_parent_idx\` ON \`_posts_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_path_idx\` ON \`_posts_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_categories_id_idx\` ON \`_posts_v_rels\` (\`categories_id\`);`)

  // --- Pages ---
  await db.run(sql`CREATE TABLE \`pages\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`title\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`meta_title\` text,
    \`meta_description\` text,
    \`meta_image_id\` integer,
    \`_status\` text DEFAULT 'draft',
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_slug_idx\` ON \`pages\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`pages_meta_image_idx\` ON \`pages\` (\`meta_image_id\`);`)
  await db.run(sql`CREATE INDEX \`pages__status_idx\` ON \`pages\` (\`_status\`);`)
  await db.run(sql`CREATE INDEX \`pages_updated_at_idx\` ON \`pages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pages_created_at_idx\` ON \`pages\` (\`created_at\`);`)

  // --- Pages blocks (for layout blocks) ---
  await db.run(sql`CREATE TABLE \`pages_blocks_content\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`rich_text\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`pages_blocks_content_order_idx\` ON \`pages_blocks_content\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_content_parent_id_idx\` ON \`pages_blocks_content\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_content_path_idx\` ON \`pages_blocks_content\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE \`pages_blocks_faq_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`question\` text NOT NULL,
    \`answer\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_items_order_idx\` ON \`pages_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_items_parent_id_idx\` ON \`pages_blocks_faq_items\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE \`pages_blocks_faq\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_order_idx\` ON \`pages_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_parent_id_idx\` ON \`pages_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_path_idx\` ON \`pages_blocks_faq\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE \`pages_blocks_cta\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`heading\` text NOT NULL,
    \`description\` text,
    \`link_label\` text NOT NULL,
    \`link_url\` text NOT NULL,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`pages_blocks_cta_order_idx\` ON \`pages_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_cta_parent_id_idx\` ON \`pages_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_cta_path_idx\` ON \`pages_blocks_cta\` (\`_path\`);`)

  // --- Pages versions ---
  await db.run(sql`CREATE TABLE \`_pages_v\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`parent_id\` integer,
    \`version_title\` text NOT NULL,
    \`version_slug\` text NOT NULL,
    \`version_meta_title\` text,
    \`version_meta_description\` text,
    \`version_meta_image_id\` integer,
    \`version__status\` text DEFAULT 'draft',
    \`version_updated_at\` text,
    \`version_created_at\` text,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`latest\` integer,
    \`autosave\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE INDEX \`_pages_v_parent_idx\` ON \`_pages_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_slug_idx\` ON \`_pages_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_meta_image_idx\` ON \`_pages_v\` (\`version_meta_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version__status_idx\` ON \`_pages_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_created_at_idx\` ON \`_pages_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_updated_at_idx\` ON \`_pages_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_latest_idx\` ON \`_pages_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_autosave_idx\` ON \`_pages_v\` (\`autosave\`);`)

  // --- Header global ---
  await db.run(sql`CREATE TABLE \`header_nav_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`label\` text NOT NULL,
    \`link\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`header\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`header_nav_items_order_idx\` ON \`header_nav_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`header_nav_items_parent_id_idx\` ON \`header_nav_items\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE \`header\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`updated_at\` text,
    \`created_at\` text
  );`)

  // --- Footer global ---
  await db.run(sql`CREATE TABLE \`footer_social_links\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`platform\` text NOT NULL,
    \`url\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`footer_social_links_order_idx\` ON \`footer_social_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`footer_social_links_parent_id_idx\` ON \`footer_social_links\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE \`footer_nav_groups_links\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`label\` text NOT NULL,
    \`url\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer_nav_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`footer_nav_groups_links_order_idx\` ON \`footer_nav_groups_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`footer_nav_groups_links_parent_id_idx\` ON \`footer_nav_groups_links\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE \`footer_nav_groups\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`title\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`footer_nav_groups_order_idx\` ON \`footer_nav_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`footer_nav_groups_parent_id_idx\` ON \`footer_nav_groups\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE \`footer\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`copyright\` text,
    \`updated_at\` text,
    \`created_at\` text
  );`)

  // --- Add caption to media ---
  await db.run(sql`ALTER TABLE \`media\` ADD COLUMN \`caption\` text;`)

  // --- Add new collection refs to locked_documents_rels ---
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`authors_id\` integer REFERENCES \`authors\`(\`id\`) ON DELETE cascade;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`categories_id\` integer REFERENCES \`categories\`(\`id\`) ON DELETE cascade;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`posts_id\` integer REFERENCES \`posts\`(\`id\`) ON DELETE cascade;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`pages_id\` integer REFERENCES \`pages\`(\`id\`) ON DELETE cascade;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_authors_id_idx\` ON \`payload_locked_documents_rels\` (\`authors_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS \`_posts_v_rels\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`_posts_v\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`posts_rels\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`posts\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`_pages_v\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_cta\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_faq\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_content\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`header_nav_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`header\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`footer_nav_groups_links\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`footer_nav_groups\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`footer_social_links\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`footer\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`categories\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`authors\`;`)
}
