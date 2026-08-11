use worker::*;

/// Minimal atproto-identity worker for claude.jason-edelman.org.
///
/// Two jobs only, matching scout-harness's proven shape at reduced scope:
/// 1. Serve /.well-known/atproto-did so this domain can be used as a custom
///    atproto handle (env.CLAUDE_DID, set once the account/DID exists).
/// 2. Forward inbound mail (Email Routing) to a real inbox so PDS signup /
///    verification isn't blocked on standing up a real mailbox. No parsing,
///    no reply logic, no agent loop - just relay.

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let url = req.url()?;
    match url.path() {
        "/health" => Response::ok("ok"),
        "/.well-known/atproto-did" => {
            let did = env.var("CLAUDE_DID")?.to_string();
            Response::ok(did)
        }
        _ => Response::error(
            "claude-identity has no HTTP surface beyond /health and /.well-known/atproto-did - it runs on Email Routing for inbound mail.",
            404,
        ),
    }
}

#[event(email)]
async fn email(message: ForwardableEmailMessage, env: Env, _ctx: Context) -> Result<()> {
    let forward_to = env.var("FORWARD_TO")?.to_string();
    message.forward(&forward_to, None).await
}
