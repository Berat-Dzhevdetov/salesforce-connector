import { LambdaModel } from "../src/core/LambdaModel";


interface AccountData {
    Id: string;
    Name: string;
}

class Account extends LambdaModel<AccountData> {
    get Id() {
        return this.get("Id");
    }

    get Name() {
        return this.get("Name");
    }
}


Account.select(x => ({
    name: x.Name
})).where(x => x.Id == "asd")