import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <main className="finance-page sign-in-page">
      <span className="eyebrow">Prumo</span>
      <h1>Entrar</h1>
      <p>Use a conta privada já cadastrada para consultar suas finanças.</p>
      <SignInForm />
    </main>
  );
}
