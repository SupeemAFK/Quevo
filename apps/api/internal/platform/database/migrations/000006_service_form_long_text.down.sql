UPDATE service_form_fields SET field_type = 'short_text' WHERE field_type = 'long_text';
ALTER TABLE service_form_fields DROP CONSTRAINT service_form_fields_field_type_check;
ALTER TABLE service_form_fields DROP CONSTRAINT service_form_fields_value_options_check;
ALTER TABLE service_form_fields ADD CONSTRAINT service_form_fields_field_type_check
    CHECK (field_type IN ('single_select', 'short_text'));
ALTER TABLE service_form_fields ADD CONSTRAINT service_form_fields_check
    CHECK ((field_type = 'single_select' AND jsonb_array_length(options) BETWEEN 1 AND 12)
        OR (field_type = 'short_text' AND jsonb_array_length(options) = 0));
