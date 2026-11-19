import express, { type Express, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';

const REPO_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const BRANCH_PATTERN = /^[a-zA-Z0-9_./-]+$/;

function getBaseAppUrl(req: Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    return envUrl.replace(/\/$/, '');
  }
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`.replace(/\/$/, '');
}

function getGithubToken(req: Request): string | null {
  const cookieToken = req.cookies?.gh_oauth_token;
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  const envToken = process.env.GITHUB_TOKEN?.trim();
  if (envToken && envToken.length > 0) {
    return envToken;
  }
  return null;
}

function buildGithubHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'KasSiklus-CashFlow-App',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function sanitizeFilePath(input: string): string {
  return input
    .trim()
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .slice(0, 200);
}

export function createApiApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // 1. GitHub OAuth configuration status
  app.get('/api/github/config', (req: Request, res: Response) => {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
    const baseUrl = getBaseAppUrl(req);
    res.json({
      oauthConfigured: Boolean(clientId && clientSecret),
      callbackUrl: `${baseUrl}/auth/callback`,
    });
  });

  // 2. Construct GitHub OAuth URL for popup flow
  app.get('/api/github/auth/url', (req: Request, res: Response) => {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      res.status(400).json({
        error: 'GITHUB_CLIENT_ID dan GITHUB_CLIENT_SECRET belum dikonfigurasi di environment server.',
      });
      return;
    }

    const baseUrl = getBaseAppUrl(req);
    const redirectUri = `${baseUrl}/auth/callback`;
    const state = crypto.randomBytes(16).toString('hex');

    res.cookie('gh_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo read:user',
      state,
    });

    res.json({
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    });
  });

  // 3. GitHub OAuth callback route (handles both with and without trailing slash)
  app.get(['/auth/callback', '/auth/callback/'], async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const savedState = typeof req.cookies?.gh_oauth_state === 'string' ? req.cookies.gh_oauth_state : '';
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

    if (!code || !clientId || !clientSecret) {
      res.status(400).send('OAuth callback tidak valid atau konfigurasi GitHub belum lengkap.');
      return;
    }

    if (savedState && state !== savedState) {
      res.status(403).send('Parameter state OAuth tidak cocok.');
      return;
    }

    try {
      const baseUrl = getBaseAppUrl(req);
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: `${baseUrl}/auth/callback`,
        }),
      });

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!tokenRes.ok || !tokenJson.access_token) {
        res.status(400).send(tokenJson.error_description || tokenJson.error || 'Gagal menukar kode OAuth GitHub.');
        return;
      }

      res.clearCookie('gh_oauth_state', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      });

      res.cookie('gh_oauth_token', tokenJson.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.send(`<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <title>GitHub Terhubung</title>
  </head>
  <body style="font-family: system-ui, sans-serif; padding: 2rem; color: #0f172a;">
    <p>Autentikasi GitHub berhasil. Jendela ini akan tertutup otomatis.</p>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
        window.close();
      } else {
        window.location.href = '/';
      }
    </script>
  </body>
</html>`);
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      res.status(500).send('Terjadi kesalahan saat memproses autentikasi GitHub.');
    }
  });

  // 4. Current GitHub auth status & accessible repositories
  app.get('/api/github/status', async (req: Request, res: Response) => {
    const token = getGithubToken(req);
    if (!token) {
      res.json({ authenticated: false, user: null, repos: [] });
      return;
    }

    try {
      const headers = buildGithubHeaders(token);
      const userRes = await fetch('https://api.github.com/user', { headers });
      if (!userRes.ok) {
        res.json({ authenticated: false, user: null, repos: [] });
        return;
      }
      const userData = (await userRes.json()) as {
        login: string;
        name: string | null;
        avatar_url: string;
        html_url: string;
      };

      const reposRes = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator',
        { headers }
      );
      const reposData = reposRes.ok
        ? ((await reposRes.json()) as Array<{
            full_name: string;
            default_branch: string;
            private: boolean;
            html_url: string;
            updated_at: string;
          }>)
        : [];

      res.json({
        authenticated: true,
        user: {
          login: userData.login,
          name: userData.name || userData.login,
          avatarUrl: userData.avatar_url,
          profileUrl: userData.html_url,
        },
        repos: reposData.map((r) => ({
          fullName: r.full_name,
          defaultBranch: r.default_branch,
          isPrivate: r.private,
          htmlUrl: r.html_url,
          updatedAt: r.updated_at,
        })),
      });
    } catch (error) {
      console.error('GitHub status error:', error);
      res.status(500).json({ error: 'Gagal memeriksa status akun GitHub.' });
    }
  });

  // 5. Disconnect GitHub OAuth session
  app.post('/api/github/logout', (_req: Request, res: Response) => {
    res.clearCookie('gh_oauth_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    res.json({ ok: true });
  });

  // 6. Inspect repository metadata, recent commits, and snapshot file status
  app.post('/api/github/inspect', async (req: Request, res: Response) => {
    const repo = typeof req.body?.repo === 'string' ? req.body.repo.trim() : '';
    const branch = typeof req.body?.branch === 'string' && req.body.branch.trim() ? req.body.branch.trim() : 'main';
    const filePath = sanitizeFilePath(
      typeof req.body?.filePath === 'string' && req.body.filePath.trim()
        ? req.body.filePath
        : 'cashflow/ledger.json'
    );

    if (!REPO_PATTERN.test(repo)) {
      res.status(400).json({ error: 'Format repositori harus owner/repo (contoh: username/cashflow-ledger).' });
      return;
    }
    if (!BRANCH_PATTERN.test(branch)) {
      res.status(400).json({ error: 'Nama branch tidak valid.' });
      return;
    }

    const token = getGithubToken(req);
    const headers = buildGithubHeaders(token);

    try {
      const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
      if (!repoRes.ok) {
        const errPayload = (await repoRes.json().catch(() => ({}))) as { message?: string };
        res.status(repoRes.status).json({
          error:
            repoRes.status === 404
              ? 'Repositori tidak ditemukan atau bersifat privat (hubungkan akun GitHub OAuth untuk repo privat).'
              : errPayload.message || 'Gagal mengambil informasi repositori dari GitHub.',
        });
        return;
      }

      const repoJson = (await repoRes.json()) as {
        full_name: string;
        description: string | null;
        private: boolean;
        default_branch: string;
        html_url: string;
        stargazers_count: number;
        updated_at: string;
      };

      const targetBranch = branch || repoJson.default_branch;

      const [commitsRes, fileRes] = await Promise.all([
        fetch(
          `https://api.github.com/repos/${repo}/commits?sha=${encodeURIComponent(targetBranch)}&per_page=5`,
          { headers }
        ),
        fetch(
          `https://api.github.com/repos/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(targetBranch)}`,
          { headers }
        ),
      ]);

      const commitsJson = commitsRes.ok
        ? ((await commitsRes.json()) as Array<{
            sha: string;
            html_url: string;
            commit: { message: string; author: { name: string; date: string } };
          }>)
        : [];

      let fileInfo: { exists: boolean; sha: string | null; htmlUrl: string | null; size: number | null } = {
        exists: false,
        sha: null,
        htmlUrl: null,
        size: null,
      };

      if (fileRes.ok) {
        const fileData = (await fileRes.json()) as {
          sha?: string;
          html_url?: string;
          size?: number;
        };
        fileInfo = {
          exists: true,
          sha: fileData.sha || null,
          htmlUrl: fileData.html_url || null,
          size: typeof fileData.size === 'number' ? fileData.size : null,
        };
      }

      res.json({
        repository: {
          fullName: repoJson.full_name,
          description: repoJson.description,
          isPrivate: repoJson.private,
          defaultBranch: repoJson.default_branch,
          htmlUrl: repoJson.html_url,
          stars: repoJson.stargazers_count,
          updatedAt: repoJson.updated_at,
        },
        branch: targetBranch,
        filePath,
        file: fileInfo,
        recentCommits: commitsJson.slice(0, 5).map((c) => ({
          sha: c.sha.slice(0, 7),
          message: c.commit.message.split('\n')[0],
          author: c.commit.author?.name || 'GitHub',
          date: c.commit.author?.date || '',
          htmlUrl: c.html_url,
        })),
        canPush: Boolean(token),
      });
    } catch (error) {
      console.error('GitHub inspect error:', error);
      res.status(500).json({ error: 'Gagal terhubung ke API GitHub.' });
    }
  });

  // 7. Import cash flow JSON ledger from GitHub repository
  app.post('/api/github/import', async (req: Request, res: Response) => {
    const repo = typeof req.body?.repo === 'string' ? req.body.repo.trim() : '';
    const branch = typeof req.body?.branch === 'string' && req.body.branch.trim() ? req.body.branch.trim() : 'main';
    const filePath = sanitizeFilePath(
      typeof req.body?.filePath === 'string' && req.body.filePath.trim()
        ? req.body.filePath
        : 'cashflow/ledger.json'
    );

    if (!REPO_PATTERN.test(repo) || !BRANCH_PATTERN.test(branch) || !filePath) {
      res.status(400).json({ error: 'Parameter repositori, branch, atau path file tidak valid.' });
      return;
    }

    const token = getGithubToken(req);
    const headers = buildGithubHeaders(token);

    try {
      const fileRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`,
        { headers }
      );
      if (!fileRes.ok) {
        res.status(fileRes.status).json({
          error:
            fileRes.status === 404
              ? `File "${filePath}" belum ditemukan di branch "${branch}".`
              : 'Gagal membaca file dari GitHub.',
        });
        return;
      }

      const fileData = (await fileRes.json()) as { content?: string; encoding?: string };
      if (!fileData.content) {
        res.status(400).json({ error: 'Konten file GitHub kosong atau terlalu besar.' });
        return;
      }

      const decoded = Buffer.from(fileData.content.replace(/\n/g, ''), 'base64').toString('utf8');
      const parsed = JSON.parse(decoded) as {
        baseOpeningBalance?: unknown;
        transactions?: unknown[];
      };

      const rawList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.transactions)
          ? parsed.transactions
          : [];

      const validTransactions = rawList
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          type: item.type === 'income' ? 'income' : 'expense',
          amount: typeof item.amount === 'number' ? item.amount : Number(item.amount),
          category: typeof item.category === 'string' ? item.category.trim().slice(0, 60) : 'Lainnya',
          description:
            typeof item.description === 'string' ? item.description.trim().slice(0, 200) : 'Impor GitHub',
          date: typeof item.date === 'string' ? item.date.trim().slice(0, 10) : '',
        }))
        .filter(
          (t) =>
            Number.isFinite(t.amount) &&
            t.amount > 0 &&
            t.amount <= 1000000000000 &&
            /^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(t.date) &&
            t.category.length > 0 &&
            t.description.length > 0
        );

      res.json({
        baseOpeningBalance:
          typeof parsed.baseOpeningBalance === 'number' && Number.isFinite(parsed.baseOpeningBalance)
            ? parsed.baseOpeningBalance
            : null,
        transactions: validTransactions,
      });
    } catch (error) {
      console.error('GitHub import error:', error);
      res.status(400).json({ error: 'Gagal mem-parsing file JSON dari repositori GitHub.' });
    }
  });

  // 8. Push / commit cash flow snapshot to GitHub repository
  app.post('/api/github/push', async (req: Request, res: Response) => {
    const token = getGithubToken(req);
    if (!token) {
      res.status(401).json({
        error: 'Hubungkan akun GitHub melalui OAuth terlebih dahulu untuk melakukan commit ke repositori.',
      });
      return;
    }

    const repo = typeof req.body?.repo === 'string' ? req.body.repo.trim() : '';
    const branch = typeof req.body?.branch === 'string' && req.body.branch.trim() ? req.body.branch.trim() : 'main';
    const filePath = sanitizeFilePath(
      typeof req.body?.filePath === 'string' && req.body.filePath.trim()
        ? req.body.filePath
        : 'cashflow/ledger.json'
    );
    const commitMessage =
      typeof req.body?.commitMessage === 'string' && req.body.commitMessage.trim()
        ? req.body.commitMessage.trim().slice(0, 120)
        : `Update cash flow ledger (${new Date().toISOString().slice(0, 10)})`;
    const payload = req.body?.payload;

    if (!REPO_PATTERN.test(repo) || !BRANCH_PATTERN.test(branch) || !filePath || !payload) {
      res.status(400).json({ error: 'Data repositori atau payload snapshot tidak lengkap.' });
      return;
    }

    const headers = {
      ...buildGithubHeaders(token),
      'Content-Type': 'application/json',
    };

    try {
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const existingRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
        { headers }
      );

      let existingSha: string | undefined;
      if (existingRes.ok) {
        const existingData = (await existingRes.json()) as { sha?: string };
        existingSha = existingData.sha;
      }

      const contentBase64 = Buffer.from(JSON.stringify(payload, null, 2), 'utf8').toString('base64');
      const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${encodedPath}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: commitMessage,
          content: contentBase64,
          branch,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      });

      const putData = (await putRes.json()) as {
        commit?: { sha: string; html_url: string };
        content?: { html_url: string };
        message?: string;
      };

      if (!putRes.ok) {
        res.status(putRes.status).json({
          error: putData.message || 'Gagal melakukan commit ke repositori GitHub.',
        });
        return;
      }

      res.json({
        ok: true,
        commitSha: putData.commit?.sha?.slice(0, 7) || '',
        commitUrl: putData.commit?.html_url || '',
        fileUrl: putData.content?.html_url || '',
      });
    } catch (error) {
      console.error('GitHub push error:', error);
      res.status(500).json({ error: 'Terjadi kesalahan saat commit snapshot ke GitHub.' });
    }
  });

  return app;
}
