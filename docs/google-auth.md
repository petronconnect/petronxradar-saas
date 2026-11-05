# Login, Google e cadastro

## Modelo

O sistema continua usando `company_users`, `company_accounts` e as sessões PostgreSQL existentes. Google é uma identidade vinculada, não um segundo cadastro de autorização. Nunca mesclar contas apenas por coincidência de e-mail. O vínculo único usa emissor + identificador estável (`sub`) e um vínculo por usuário.

Cadastro público cria somente uma solicitação pendente. A ativação continua dependendo de pagamento confirmado ou provisionamento administrativo autorizado. O checkout exige a solicitação pertencente à sessão do navegador. Contas/empresas já existentes devem usar login ou atendimento administrativo, não receber acesso por um pagamento anônimo.

## Configuração Google

No Google Cloud, configure a tela de consentimento e crie uma credencial OAuth do tipo **Aplicativo da Web**. Use apenas os escopos `openid email`. Enquanto o consentimento estiver em teste, adicione os usuários de teste.

Configure `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` como Secrets, nunca no frontend. Configure `GOOGLE_CALLBACK_URL` por ambiente, com HTTPS e caminho exato `/api/auth/google/callback`, e registre a mesma URL na lista de URIs de redirecionamento autorizados no Google Cloud. Não use curingas. Este fluxo usa redirecionamento pelo servidor, não o SDK JavaScript do Google; não depende de origens JavaScript autorizadas.

Use credenciais separadas para teste e produção. Obtenha o domínio publicado real antes de configurar o retorno de produção; não reutilize o domínio de preview como retorno de produção.

`SESSION_SECRET` é obrigatório e deve ter pelo menos 32 caracteres em produção. A ausência de configuração Google desabilita a opção na interface com uma explicação; não afeta login por senha.

## Banco e dados temporários

Os arquivos `artifacts/api-server/migrations/20261105-google-auth.sql` e `20261105-payment-recovery.sql` são aditivos e **somente para desenvolvimento**. O esquema Drizzle espelha as adições. Não executar scripts nem alterar dados de produção nesta tarefa. A publicação gerenciada aplica o diff de esquema mediante aprovação do operador.

Fluxos OAuth duram 10 minutos, são vinculados ao navegador e consumidos atomicamente no callback. Fluxos expirados são removidos ao iniciar outro fluxo. A intenção de cadastro Google dura 30 minutos na sessão do servidor; o pagamento guarda apenas emissor, identificador e e-mail para conferir o vínculo. Tokens de acesso, refresh e códigos OAuth não são persistidos no navegador ou enviados aos logs.

O claim do pagamento é de uso único e não dá posse de empresas/usuários já existentes. Para contas novas Google, o vínculo ocorre somente após confirmar pagamento, claim e identidade; o hash aleatório inicial não funciona como senha local, e o onboarding não exige senha fictícia.

Vinculação de contas existentes exige sessão autenticada recentemente (10 minutos). Usuários com senha confirmam novamente o login quando necessário. Usuários Google confirmam novamente a identidade para alterações sensíveis. Papéis e empresa vêm do banco.

## Validação manual após configurar credenciais

1. Testar login por senha, atualizar a página, sair e tentar reutilizar a sessão anterior.
2. Entrar com Google sem vínculo: esperar mensagem orientando login/vinculação, nunca assumir conta pelo e-mail.
3. Entrar pela senha no perfil, vincular Google, sair e entrar pelo Google; conferir empresa e papel.
4. Cancelar o consentimento; repetir um callback; adulterar state; tentar outro navegador. Todos devem ser recusados.
5. Cadastrar nova empresa com Google, concluir pagamento de teste e claim; conferir conta única, onboarding sem senha local e login posterior.
6. Tentar cadastro sem pagamento, claim inválido e CNPJ/e-mail existente; não deve haver acesso ao produto.
7. Testar conta inativa e vínculo já associado a outro usuário.

Os testes automatizados usam um provedor simulado. **Login Google real não foi validado**, pois as credenciais não foram fornecidas.

## Retomada do acesso após pagamento

Ao gerar um Pix, o servidor emite um recibo independente de recuperação em cookie HttpOnly, SameSite=Lax, Secure em produção, limitado a `/api`, com duração de sete dias. Só seu hash é persistido no pagamento. Ele não é acessível ao JavaScript nem ao localStorage e continua disponível após recarregar a página ou perder a sessão. A consulta de recuperação retorna apenas metadados não secretos e exige esse recibo.

O checkout reencontra o pagamento e permite tentar novamente, sem gerar outro Pix. Se a prova Google de 30 minutos expirou, a ação “Confirmar novamente com Google” exige o mesmo emissor, identificador estável e e-mail do pagamento, mesmo se a conta já foi provisionada. O callback retorna ao checkout para retomar a liberação.

O claim original só é consumido depois de salvar a sessão autenticada. Erros de gravação deixam o claim disponível; o recibo também permite recuperação se a resposta de sucesso se perder. Após sucesso, o navegador recebe a remoção do recibo. O hash do recibo permanece válido até sua expiração para lidar com respostas perdidas: trate-o como uma credencial temporária de acesso, nunca como dado de analytics ou log. O recibo nunca autoriza uma conta preexistente, pagamento não aprovado ou identidade Google diferente.
