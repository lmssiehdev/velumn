import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Image metadata
export const size = {
    width: 1200,
    height: 630,
}

export const contentType = 'image/png';
export const runtime = 'nodejs';

console.log({ url: import.meta.url, cwd: process.cwd() })
// Image generation
export default async function Image({ params }: { params: { slug: string } }) {

    const url = new URL('../../../../styles/fonts/FunnelSans-VariableFont_wght.ttf', import.meta.url);
    const FunnelSans = await fetch(url).then((res) => res.arrayBuffer())
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 128,
                    background: 'red',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    fontWeight: "bold",
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'FunnelSans',
                }}
            >
                title
            </div>
        ), {
        ...size,
        //   fonts: [
        //     {
        //       name: 'FunnelSans',
        //       data: FunnelSans,
        //       style: 'normal',
        //       weight: 400,
        //     },
        // ]
    }
    )
}