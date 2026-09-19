-- Migration 023: group currency/country, groundwork only.
--
-- Every group today is priced and displayed in Zambian Kwacha with no
-- way to record otherwise — src/lib/money.js / worker/src/money.js
-- consolidate what used to be nine near-identical "K" + toLocaleString
-- formatters into one, and these two columns are the schema half of
-- that: a place to eventually record a group's actual currency/country
-- once this app supports more than one. NOT NULL with a default rather
-- than nullable, since every existing group genuinely IS Zambian
-- Kwacha/Zambia today — no ambiguous "unset" state, and existing rows
-- need zero backfill since DEFAULT covers them automatically.
--
-- Deliberately NOT wired to a picker UI or to SUBSCRIPTION_PRICE yet —
-- this is schema groundwork, not a multi-currency feature.
--
-- Apply with:
--   scripts/apply-migration.sh worker/schema/migrations/023_group_currency.sql

ALTER TABLE groups ADD COLUMN currency TEXT NOT NULL DEFAULT 'ZMW';
ALTER TABLE groups ADD COLUMN country TEXT NOT NULL DEFAULT 'ZM';
