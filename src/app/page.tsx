import { redirect } from "next/navigation";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const code = firstParam(params.code);
  const tokenHash = firstParam(params.token_hash);
  const type = firstParam(params.type);

  if (code) {
    const callbackParams = new URLSearchParams({
      code,
      next: "/login?confirmed=1",
    });

    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  if (tokenHash && type) {
    const callbackParams = new URLSearchParams({
      token_hash: tokenHash,
      type,
      next: "/login?confirmed=1",
    });

    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  redirect("/rh");
}
