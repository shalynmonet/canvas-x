CREATE TABLE public.todo_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  deadline date,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_items TO authenticated;
GRANT ALL ON public.todo_items TO service_role;
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own todo items" ON public.todo_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);