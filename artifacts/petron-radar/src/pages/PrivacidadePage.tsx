import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/landing" className="font-bold tracking-tight">
            <span className="text-primary">PETRON</span> RADAR
          </Link>
          <Link
            href="/landing"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Última atualização: 11 de junho de 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <p>
            Esta Política descreve como o <strong>Petron Radar</strong> coleta, utiliza, armazena e protege
            dados pessoais, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).
          </p>

          <Section title="1. Controlador dos Dados">
            <p>
              O controlador é a empresa responsável pela plataforma Petron Radar. Contato do encarregado
              (DPO) e canais de atendimento:{" "}
              <a href="mailto:contato@petronxradar.com" className="text-primary hover:underline">
                contato@petronxradar.com
              </a>{" "}
              — WhatsApp +55 (13) 99803-5663.
            </p>
          </Section>

          <Section title="2. Dados que Coletamos">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Dados de cadastro e contato:</strong> nome do responsável, e-mail, telefone/WhatsApp,
                cargo, razão social, nome fantasia, CNPJ, cidade e estado.
              </li>
              <li>
                <strong>Dados de uso:</strong> registros de acesso, páginas visitadas, oportunidades
                acompanhadas e interações com a Plataforma.
              </li>
              <li>
                <strong>Dados de pagamento:</strong> processados por provedores de pagamento; não armazenamos
                dados completos de cartão.
              </li>
            </ul>
          </Section>

          <Section title="3. Finalidades do Tratamento">
            <ul className="list-disc pl-5 space-y-1">
              <li>prestar e operar o Serviço contratado e liberar o acesso;</li>
              <li>processar pagamentos e gerenciar assinaturas;</li>
              <li>enviar comunicações operacionais, boletins e suporte;</li>
              <li>melhorar a Plataforma e prevenir fraudes e abusos;</li>
              <li>cumprir obrigações legais e regulatórias.</li>
            </ul>
          </Section>

          <Section title="4. Bases Legais">
            <p>
              Tratamos dados com fundamento na execução de contrato, no cumprimento de obrigação legal, no
              legítimo interesse (ex.: segurança e melhoria do Serviço) e, quando aplicável, no consentimento
              do titular.
            </p>
          </Section>

          <Section title="5. Compartilhamento de Dados">
            <p>
              Compartilhamos dados apenas com operadores necessários à prestação do Serviço, como provedores
              de pagamento (ex.: Mercado Pago), infraestrutura de hospedagem e ferramentas de comunicação,
              sempre limitados à finalidade e sujeitos a obrigações de confidencialidade. Também podemos
              compartilhar dados para cumprir determinação legal ou judicial.
            </p>
          </Section>

          <Section title="6. Cookies e Tecnologias Semelhantes">
            <p>
              Utilizamos cookies e armazenamento local essenciais para autenticação, segurança e
              funcionamento da Plataforma, além de recursos que permitem a instalação como aplicativo (PWA).
            </p>
          </Section>

          <Section title="7. Armazenamento e Segurança">
            <p>
              Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados contra acesso não
              autorizado, perda ou alteração. As credenciais de acesso são armazenadas de forma cifrada.
            </p>
          </Section>

          <Section title="8. Retenção">
            <p>
              Mantemos os dados pelo tempo necessário às finalidades descritas e ao cumprimento de obrigações
              legais. Encerrada a relação, os dados podem ser anonimizados ou eliminados, ressalvadas as
              hipóteses de guarda obrigatória.
            </p>
          </Section>

          <Section title="9. Direitos do Titular">
            <p>Nos termos da LGPD, o titular pode solicitar, a qualquer momento:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>confirmação da existência de tratamento e acesso aos dados;</li>
              <li>correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>portabilidade e informação sobre compartilhamento;</li>
              <li>revogação do consentimento.</li>
            </ul>
            <p>
              Para exercer seus direitos, entre em contato pelo e-mail{" "}
              <a href="mailto:contato@petronxradar.com" className="text-primary hover:underline">
                contato@petronxradar.com
              </a>
              .
            </p>
          </Section>

          <Section title="10. Alterações desta Política">
            <p>
              Esta Política pode ser atualizada periodicamente. A versão vigente estará sempre disponível na
              Plataforma, com a respectiva data de atualização.
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-border/50 bg-background py-8">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          &copy; 2026 Petron Radar Premium. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
