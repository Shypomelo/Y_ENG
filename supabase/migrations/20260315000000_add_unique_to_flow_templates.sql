-- Migration: Add unique constraint to flow_templates
-- To support upsert and prevent duplicate templates

-- Ensure no duplicates exist (though check_templates.js confirmed 0, this is good practice)
-- DELETE FROM public.flow_templates a USING public.flow_templates b WHERE a.id > b.id AND a.name = b.name AND a.department = b.department;

ALTER TABLE public.flow_templates 
ADD CONSTRAINT flow_templates_name_unique UNIQUE (name);
