import { DBMessage } from "@repo/db/schema/discord";
import { dayjs } from "@repo/utils/helpers/dayjs";

type DBEmbed = NonNullable<DBMessage["embeds"]>[number];

export function Embeds({ embeds }: { embeds: DBEmbed[] | null }) {
  if (!embeds?.length) return null;
  return <>
    {
      embeds.map((embed, idx) => {
        const borderLeftColor = embed.color ? '#' + embed.color.toString(16).padStart(6, '0') : "dadadc";
        if (embed.type === "gifv") {
          const { height, width } = embed.video!
          return (
            <div key={idx} className="mt-4 rounded overflow-hidden">
              <video
                src={embed.video?.url}
                poster={embed.thumbnail?.url}
                autoPlay
                loop
                muted
                style={getScaledDownWidth({ width: width!, height: height! })}
              />
            </div>
          );
        }
        if (embed.type === "image") {
          const { height, width, url } = embed.image! ?? embed.thumbnail!;
          return (
            <div key={idx} className="mt-4 rounded overflow-hidden">
              <img
                src={embed.url}
                style={getScaledDownWidth({ width: width!, height: height! })}
              />
            </div>
          );
        }

        const previewUrl = embed.image ?? embed.thumbnail;
        return (
          <div key={idx} className="grid w-md  border border-l-4 rounded-md shadow-xs pt-2 px-4 pb-3" style={{
            borderLeftColor
          }}>
            {
              embed.provider && <span className="text-xs text-neutral-600">{embed.provider.name}</span>
            }
            {
              embed.author && <a className="text-sm  hover:underline font-semibold mt-2" target="_blank" href={embed.author.url}>{embed.author.name}</a>
            }
            {
              embed.title && <a className="hover:underline font-semibold mt-2 text-blue-500" target="_blank" href={embed.url}>{embed.title}</a>
            }
            {
              embed.type !== "video" && <div className="text-sm text-neutral-500 mt-1">{embed.description}</div>
            }
            <div className="mt-4 rounded overflow-hidden max-h-[300px]">
              <img src={previewUrl?.url} className="overflow-hidden object-cover max-h-[100%] max-w-[100%]" style={getScaledDownWidth({ width: previewUrl?.width!, height: previewUrl?.height! })} />
            </div>
            <div>
              {
                embed.footer && <div className="flex items-center mt-2">
                  <img className="rounded-full size-5 object-contain mr-2" src={embed.footer.icon_url} />
                  <div className="text-[13px] flex items-center gap-1">
                    <p>
                      {
                        embed.footer.text
                      }
                    </p>
                    •
                    <p>
                      {
                        dayjs(embed.timestamp).format('M/D/YY, h:mm A')
                      }
                    </p>
                  </div>
                </div>
              }
            </div>
          </div>
        )
      })
    }
  </>
}

function getScaledDownWidth({ height, width }: { height: number, width: number }) {
  const MAX_WIDTH = 400;
  const MAX_HEIGHT = 300;

  const heightScale = Math.min(1, MAX_HEIGHT / height);
  const widthScale = Math.min(1, MAX_WIDTH / width);
  const scale = Math.min(heightScale, widthScale);

  const scaledWidth = Math.floor(width * scale);
  const scaledHeight = Math.floor(height * scale);

  return {
    width: `${scaledWidth}px`,
    height: `${scaledHeight}px`,
    maxWidth: '100%'
  }
}
