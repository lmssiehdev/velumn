export function getServerIcon(guild: { icon: string | null; id: string }) {
    const format = guild.icon?.startsWith('a_') ? 'gif' : 'png';

    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${format}?size={64}`;
}