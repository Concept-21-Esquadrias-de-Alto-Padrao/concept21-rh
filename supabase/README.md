# Supabase - Módulo de RH

Este projeto usa Supabase diretamente: PostgreSQL, Auth, Storage, SQL nativo, RBAC no banco e RLS.

Ordem recomendada:

1. Aplique as migrations em `supabase/migrations` no Supabase SQL Editor ou via Supabase CLI.
2. Aplique os seeds em `supabase/seeds`, incluindo `004_seed_labor_costs.sql` para categorias, componentes e regras iniciais de custos.
3. Crie o primeiro usuário pelo Supabase Auth.
4. Crie um registro em `public.profiles` vinculado ao `auth.users.id`.
5. Vincule esse profile ao papel `master` em `public.user_roles`.

O bucket privado `hr-documents` e criado na migration `004_enable_hr_rls_and_storage.sql`. Os arquivos devem ser acessados por URL assinada, nunca por URL publica.
