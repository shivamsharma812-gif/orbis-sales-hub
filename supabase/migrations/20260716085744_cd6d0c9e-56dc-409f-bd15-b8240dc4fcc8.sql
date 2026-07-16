
CREATE POLICY "crm_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crm-documents');
CREATE POLICY "crm_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-documents');
CREATE POLICY "crm_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crm-documents');
