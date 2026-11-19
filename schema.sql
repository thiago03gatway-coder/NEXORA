CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS nexora_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  cpf_hash TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 100),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  numbers INTEGER[] NOT NULL,
  venda_id TEXT UNIQUE,
  correlation_id TEXT,
  pix_code TEXT,
  qr_code_url TEXT,
  check_status_url TEXT,
  event_id TEXT NOT NULL,
  tracking JSONB,
  utm JSONB,
  status TEXT NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','pending','paid','expired','cancelled','refunded','failed')),
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nexora_campaign_numbers (
  campaign_id TEXT NOT NULL,
  number INTEGER NOT NULL CHECK (number >= 0 AND number < 10000),
  order_id UUID REFERENCES nexora_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('reserved','sold','released')),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, number)
);

CREATE INDEX IF NOT EXISTS nexora_orders_cpf_hash_idx ON nexora_orders(campaign_id, cpf_hash, status);
CREATE INDEX IF NOT EXISTS nexora_numbers_status_idx ON nexora_campaign_numbers(campaign_id, status, expires_at);
