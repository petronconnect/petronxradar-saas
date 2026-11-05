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

export default function TermosPage() {
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
        <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Última atualização: 11 de junho de 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <p>
            Estes Termos de Uso regulam o acesso e a utilização da plataforma <strong>Petron Radar</strong>{" "}
            ("Plataforma", "Serviço"), operada pela empresa responsável pelo Petron Radar Premium ("Petron
            Radar", "nós"). Ao contratar, acessar ou utilizar a Plataforma, você ("Cliente", "Usuário")
            declara ter lido, compreendido e concordado com estes Termos.
          </p>

          <Section title="1. Descrição do Serviço">
            <p>
              O Petron Radar é uma plataforma de inteligência de mercado para o setor de Óleo &amp; Gás,
              voltada a empresas com CNPJ ativo. Disponibilizamos boletins, organização e análise
              informativa de oportunidades e licitações, ferramentas de acompanhamento (portfólio) e
              materiais de apoio.
            </p>
            <p>
              As informações exibidas têm caráter informativo e de apoio à decisão. O Petron Radar não é o
              órgão licitante e não substitui a consulta aos portais e documentos oficiais (como o
              Petronect), tampouco constitui assessoria jurídica, contábil ou de habilitação.
            </p>
          </Section>

          <Section title="2. Cadastro e Acesso">
            <p>
              O acesso é restrito a clientes contratantes. As credenciais são pessoais e intransferíveis; o
              Cliente é responsável por mantê-las em sigilo e por toda atividade realizada em sua conta.
              Comunique-nos imediatamente qualquer uso não autorizado.
            </p>
          </Section>

          <Section title="3. Planos, Pagamentos e Renovação">
            <p>
              Os planos e valores vigentes são apresentados na Plataforma. As assinaturas são cobradas de
              forma recorrente conforme o plano contratado, podendo o pagamento ser realizado via Pix, entre
              outros meios disponibilizados. O acesso é liberado após a confirmação do pagamento.
            </p>
            <p>
              O cancelamento pode ser solicitado a qualquer momento e interrompe renovações futuras; o acesso
              permanece ativo até o fim do ciclo já pago. Valores já pagos referentes ao período em curso não
              são, em regra, reembolsáveis, salvo disposição legal em contrário.
            </p>
          </Section>

          <Section title="4. Uso Aceitável">
            <p>Ao utilizar a Plataforma, o Cliente concorda em não:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>compartilhar credenciais ou permitir o acesso de terceiros não autorizados;</li>
              <li>copiar, revender, redistribuir ou extrair automaticamente (scraping) o conteúdo;</li>
              <li>utilizar o Serviço para fins ilícitos ou que violem direitos de terceiros;</li>
              <li>tentar comprometer a segurança, a integridade ou a disponibilidade da Plataforma.</li>
            </ul>
          </Section>

          <Section title="5. Propriedade Intelectual">
            <p>
              A Plataforma, sua marca, layout, textos, análises e materiais são protegidos e pertencem ao
              Petron Radar ou a seus licenciadores. A contratação concede ao Cliente uma licença de uso
              limitada, não exclusiva e intransferível, durante a vigência da assinatura.
            </p>
          </Section>

          <Section title="6. Isenção e Limitação de Responsabilidade">
            <p>
              As decisões de participação em licitações, bem como a verificação de prazos, editais e
              documentos oficiais, são de responsabilidade exclusiva do Cliente. O Petron Radar não garante a
              exatidão, completude ou atualidade de dados originados de fontes de terceiros e não se
              responsabiliza por perdas decorrentes de decisões tomadas com base nas informações da
              Plataforma, na máxima extensão permitida pela legislação aplicável.
            </p>
          </Section>

          <Section title="7. Proteção de Dados (LGPD)">
            <p>
              O tratamento de dados pessoais observa a Lei nº 13.709/2018 (LGPD) e está detalhado na nossa{" "}
              <Link href="/privacidade" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
              , que integra estes Termos.
            </p>
          </Section>

          <Section title="8. Alterações dos Termos">
            <p>
              Podemos atualizar estes Termos periodicamente. A versão vigente estará sempre disponível na
              Plataforma, com a data da última atualização. O uso continuado após mudanças significa
              concordância com a versão revisada.
            </p>
          </Section>

          <Section title="9. Legislação e Foro">
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do
              domicílio do Cliente para dirimir eventuais controvérsias, quando aplicável a relação de
              consumo, ou, nos demais casos, o foro da sede da empresa responsável pela Plataforma.
            </p>
          </Section>

          <Section title="10. Contato">
            <p>
              Dúvidas sobre estes Termos podem ser encaminhadas para{" "}
              <a href="mailto:contato@petronxradar.com" className="text-primary hover:underline">
                contato@petronxradar.com
              </a>{" "}
              ou pelo WhatsApp +55 (13) 99803-5663. Os dados completos da pessoa jurídica responsável estão
              disponíveis mediante solicitação.
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
