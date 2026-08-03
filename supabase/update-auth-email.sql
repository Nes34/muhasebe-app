-- Auth e-postasını güncellemek için fonksiyon
-- Supabase SQL Editor'dan çalıştırın

CREATE OR REPLACE FUNCTION update_auth_user_email(target_user_id uuid, new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users SET email = new_email, raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{email}', to_jsonb(new_email)) WHERE id = target_user_id;
END;
$$;

-- Yetkilendirme
GRANT EXECUTE ON FUNCTION update_auth_user_email(uuid, text) TO authenticated;
