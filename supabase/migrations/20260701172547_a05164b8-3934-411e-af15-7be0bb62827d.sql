
CREATE POLICY "Staff read product images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff write product images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff update product images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete product images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff read product docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-documents' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff write product docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-documents' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff update product docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-documents' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete product docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-documents' AND public.is_staff(auth.uid()));
