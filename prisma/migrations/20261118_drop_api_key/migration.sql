-- Tranche A fix 14: the ApiKey table only ever stored the orphan Settings
-- credential fields (twilio_sid/token/from, google/outlook client id/secret)
-- that no code anywhere read. Drop it.
DROP TABLE IF EXISTS "api_keys";
