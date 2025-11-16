import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { CommandDialogDemo } from "./_component";

export default async function Page() {
	const data = { hits: [] };

	return (
		<div>
			<form>
				<InputGroup>
					<InputGroupInput placeholder="Search..." />
					<InputGroupAddon>
						<MagnifyingGlassIcon />
					</InputGroupAddon>
					<InputGroupAddon align="inline-end">12 results</InputGroupAddon>
				</InputGroup>
				<Button variant="outline" type="submit">
					Search
				</Button>
			</form>
			<CommandDialogDemo hits={data.hits} />
		</div>
	);
}
