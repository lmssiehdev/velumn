import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repository = "discord/discord-api-spec";
const upstreamFile = "specs/openapi.json";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorDirectory = path.join(root, "vendor/discord-api-spec");
const specPath = path.join(vendorDirectory, "openapi.json");
const licensePath = path.join(vendorDirectory, "LICENSE");
const sourcePath = path.join(vendorDirectory, "source.json");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function validateSpec(value) {
	const spec = JSON.parse(value.toString("utf8"));
	if (spec.openapi !== "3.1.0") {
		throw new Error(
			`Expected OpenAPI 3.1.0, received ${spec.openapi ?? "none"}`,
		);
	}
	if (spec.info?.title !== "Discord HTTP API (Preview)") {
		throw new Error("Downloaded document is not the Discord HTTP API preview");
	}
	if (spec.info?.version !== "10") {
		throw new Error(`Expected Discord API v10, received ${spec.info?.version}`);
	}
}

async function fetchBuffer(url) {
	const response = await fetch(url, {
		headers: { "user-agent": "velumn-discord-spec-vendor" },
	});
	if (!response.ok) {
		throw new Error(`Unable to fetch ${url}: ${response.status}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

async function update() {
	const commitResponse = await fetch(
		`https://api.github.com/repos/${repository}/commits/main`,
		{
			headers: {
				accept: "application/vnd.github+json",
				"user-agent": "velumn-discord-spec-vendor",
			},
		},
	);
	if (!commitResponse.ok) {
		throw new Error(
			`Unable to resolve upstream commit: ${commitResponse.status}`,
		);
	}
	const commit = (await commitResponse.json()).sha;
	if (!/^[0-9a-f]{40}$/.test(commit)) {
		throw new Error("Upstream returned an invalid commit SHA");
	}

	const rawBase = `https://raw.githubusercontent.com/${repository}/${commit}`;
	const rawUrl = `${rawBase}/${upstreamFile}`;
	const [spec, license] = await Promise.all([
		fetchBuffer(rawUrl),
		fetchBuffer(`${rawBase}/LICENSE`),
	]);
	validateSpec(spec);

	await mkdir(vendorDirectory, { recursive: true });
	await Promise.all([
		writeFile(specPath, spec),
		writeFile(licensePath, license),
		writeFile(
			sourcePath,
			`${JSON.stringify(
				{
					repository: `https://github.com/${repository}`,
					commit,
					file: upstreamFile,
					rawUrl,
					sha256: sha256(spec),
					byteCount: spec.byteLength,
					license: "MIT",
				},
				null,
				"\t",
			)}\n`,
		),
	]);
	console.log(`Vendored Discord API spec at ${commit}`);
}

async function check() {
	const [spec, license, sourceValue] = await Promise.all([
		readFile(specPath),
		readFile(licensePath, "utf8"),
		readFile(sourcePath, "utf8"),
	]);
	const source = JSON.parse(sourceValue);
	validateSpec(spec);

	if (source.repository !== `https://github.com/${repository}`) {
		throw new Error("source.json contains an unexpected repository");
	}
	if (source.file !== upstreamFile) {
		throw new Error("source.json contains an unexpected upstream file");
	}
	if (sha256(spec) !== source.sha256) {
		throw new Error("Vendored spec SHA-256 does not match source.json");
	}
	if (spec.byteLength !== source.byteCount) {
		throw new Error("Vendored spec byte count does not match source.json");
	}
	if (!/^[0-9a-f]{40}$/.test(source.commit)) {
		throw new Error("source.json contains an invalid commit SHA");
	}
	const expectedRawUrl = `https://raw.githubusercontent.com/${repository}/${source.commit}/${upstreamFile}`;
	if (source.rawUrl !== expectedRawUrl) {
		throw new Error("source.json raw URL does not match its pinned commit");
	}
	if (source.license !== "MIT") {
		throw new Error("source.json contains an unexpected license");
	}
	if (!license.includes("MIT License") || !license.includes("Discord")) {
		throw new Error("Vendored Discord MIT license is missing or invalid");
	}
	console.log(`Verified Discord API spec at ${source.commit}`);
}

const command = process.argv[2];
if (command === "update") await update();
else if (command === "check") await check();
else throw new Error("Usage: node scripts/discord-api-spec.mjs <update|check>");
