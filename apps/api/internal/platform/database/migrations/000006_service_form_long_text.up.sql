ALTER TABLE service_form_fields DROP CONSTRAINT service_form_fields_field_type_check;
ALTER TABLE service_form_fields DROP CONSTRAINT service_form_fields_check;
ALTER TABLE service_form_fields ADD CONSTRAINT service_form_fields_field_type_check
    CHECK (field_type IN ('single_select', 'short_text', 'long_text'));
ALTER TABLE service_form_fields ADD CONSTRAINT service_form_fields_value_options_check
    CHECK ((field_type = 'single_select' AND jsonb_array_length(options) BETWEEN 1 AND 12)
        OR (field_type IN ('short_text', 'long_text') AND jsonb_array_length(options) = 0));

UPDATE service_form_fields SET label = 'Which account are you interested in?'
WHERE id = '10000000-0000-4000-8000-000000000020';
UPDATE service_form_fields SET label = 'What card service do you need?'
WHERE id = '10000000-0000-4000-8000-000000000021';
UPDATE service_form_fields SET label = 'Which loan product would you like to discuss?'
WHERE id = '10000000-0000-4000-8000-000000000022';
UPDATE service_form_fields SET label = 'What would you like to update?'
WHERE id = '10000000-0000-4000-8000-000000000023';
UPDATE service_form_fields SET label = 'Which digital banking service needs help?'
WHERE id = '10000000-0000-4000-8000-000000000024';

UPDATE service_form_fields SET field_type = 'long_text', label = 'What would you like to ask the account team?', required = false, options = '[]'::jsonb
WHERE id = '10000000-0000-4000-8000-000000000026';
UPDATE service_form_fields SET field_type = 'short_text', label = 'What type of card is this about? Do not enter a card number.', required = false, options = '[]'::jsonb
WHERE id = '10000000-0000-4000-8000-000000000027';
UPDATE service_form_fields SET field_type = 'long_text', label = 'Briefly describe what happened. Do not include card details.', required = false, options = '[]'::jsonb
WHERE id = '10000000-0000-4000-8000-000000000028';
UPDATE service_form_fields SET field_type = 'long_text', label = 'What should the loan officer know? Leave out income and ID details.', required = false, options = '[]'::jsonb
WHERE id = '10000000-0000-4000-8000-000000000030';
UPDATE service_form_fields SET field_type = 'short_text', label = 'Which account type should staff review? Do not enter an account number.', required = false, options = '[]'::jsonb
WHERE id = '10000000-0000-4000-8000-000000000031';
UPDATE service_form_fields SET field_type = 'long_text', label = 'What should staff prepare for? Do not include an account number.', required = false, options = '[]'::jsonb
WHERE id = '10000000-0000-4000-8000-000000000032';
UPDATE service_form_fields SET field_type = 'short_text', label = 'What device model are you using? For example, iPhone 15.', required = false, options = '[]'::jsonb
WHERE id = '10000000-0000-4000-8000-000000000033';
UPDATE service_form_fields SET field_type = 'long_text', label = 'What happened? Do not include passwords, PINs, or one-time codes.', required = false, options = '[]'::jsonb
WHERE id = '10000000-0000-4000-8000-000000000034';
