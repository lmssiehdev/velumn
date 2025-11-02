export async function wipePolarCustomer() {
    if (!process.env.POLAR_TEST_EMAIL) {
        console.log("No email found")
        return;
    }

    const email = process.env.POLAR_TEST_EMAIL;
    try {
        const response = await fetch('https://api.polar.sh/v1/customers', {
            headers: {
                'Authorization': `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        console.log({ data })
        const customer = data.items?.find((c: any) => c.email === email);

        if (customer) {
            await fetch(`https://api.polar.sh/v1/customers/${customer.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
                },
            });
            console.log(`Polar customer deleted: ${email}`);
        }
        console.log(`No customer found for email:`, email,)
    } catch (error) {
        console.error('Error deleting Polar customer:', error);
    }
}

await wipePolarCustomer();