// Minimal GitLab REST client using Node's built-in fetch (available in the
// image's Node 21 runtime) - deliberately dependency-free since this is the
// only API call these scripts need (reading the MR description).

function apiBase() {
  const base = process.env.CI_API_V4_URL;
  if (!base) {
    throw new Error('CI_API_V4_URL is not set - this script must run inside a GitLab CI job.');
  }
  return base;
}

function authHeaders() {
  // CI_JOB_TOKEN works out of the box when the project allows job-token API
  // access to itself (GitLab 16+ default). GITLAB_API_TOKEN is the documented
  // fallback for projects that disabled that or run on older GitLab.
  if (process.env.GITLAB_API_TOKEN) {
    return { 'PRIVATE-TOKEN': process.env.GITLAB_API_TOKEN };
  }
  if (process.env.CI_JOB_TOKEN) {
    return { 'JOB-TOKEN': process.env.CI_JOB_TOKEN };
  }
  throw new Error(
    'No GitLab API credentials available. CI_JOB_TOKEN is normally set automatically by GitLab CI; if job-token ' +
      'API access is restricted for this project, add a masked GITLAB_API_TOKEN CI/CD variable (read_api scope).'
  );
}

export async function fetchMergeRequest(projectId, mergeRequestIid) {
  const url = `${apiBase()}/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}`;
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(
      `GitLab API request for merge request !${mergeRequestIid} failed: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}

export function resolveCurrentMergeRequest() {
  const projectId = process.env.CI_PROJECT_ID;
  const mergeRequestIid = process.env.CI_MERGE_REQUEST_IID;
  if (!projectId || !mergeRequestIid) {
    throw new Error(
      'CI_PROJECT_ID / CI_MERGE_REQUEST_IID are not set - this script must run in a GitLab merge request pipeline.'
    );
  }
  return { projectId, mergeRequestIid };
}
