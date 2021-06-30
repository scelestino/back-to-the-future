const fs = require("fs");
const chalk = require("chalk");
const bre = require("hardhat");

const publishDir = "../react-app/src/contracts";
const graphDir = "../subgraph"

function publishContract(prefix, contractName, alias = "", fixedAddress = "") {

  const name = alias != "" ? alias : contractName

  console.log(
    " 💽 Publishing",
    chalk.cyan(name),
    "to",
    chalk.gray(publishDir)
  );
  try {
    let contract = fs
      .readFileSync(`${bre.config.paths.artifacts}/contracts/${prefix}${contractName}.sol/${contractName}.json`)
      .toString();
    const address = fixedAddress != "" ? fixedAddress : fs
      .readFileSync(`${bre.config.paths.artifacts}/${contractName}.address`)
      .toString();
    contract = JSON.parse(contract);
    let graphConfigPath = `${graphDir}/config/config.json`
    let graphConfig
    try {
      if (fs.existsSync(graphConfigPath)) {
        graphConfig = fs
          .readFileSync(graphConfigPath)
          .toString();
      } else {
        graphConfig = '{}'
      }
      } catch (e) {
        console.log(e)
      }

    graphConfig = JSON.parse(graphConfig)
    graphConfig[name + "Address"] = address
    fs.writeFileSync(
      `${publishDir}/${name}.address.js`,
      `module.exports = "${address}";`
    );
    fs.writeFileSync(
      `${publishDir}/${name}.abi.js`,
      `module.exports = ${JSON.stringify(contract.abi, null, 2)};`
    );
    fs.writeFileSync(
      `${publishDir}/${name}.bytecode.js`,
      `module.exports = "${contract.bytecode}";`
    );

    const folderPath = graphConfigPath.replace("/config.json","")
    if (!fs.existsSync(folderPath)){
      fs.mkdirSync(folderPath);
    }
    fs.writeFileSync(
      graphConfigPath,
      JSON.stringify(graphConfig, null, 2)
    );
    fs.writeFileSync(
      `${graphDir}/abis/${name}.json`,
      JSON.stringify(contract.abi, null, 2)
    );

    console.log(" 📠 Published "+chalk.green(name)+" to the frontend.")

    return true;
  } catch (e) {
    if(e.toString().indexOf("no such file or directory")>=0){
      console.log(chalk.yellow(" ⚠️  Can't publish "+name+" yet (make sure it getting deployed)."))
    }else{
      console.log(e);
      return false;
    }
  }
}

async function main() {
  if (!fs.existsSync(publishDir)) {
    fs.mkdirSync(publishDir);
  }
  const finalContractList = [];
  fs.readdirSync(bre.config.paths.sources).forEach((file) => {
    if (file.indexOf(".sol") >= 0) {
      const contractName = file.replace(".sol", "");
      // Add contract to list if publishing is successful
      if (publishContract("", contractName)) {
        finalContractList.push(contractName);
      }
    }
  });

  publishContract("stubs/", "ERC20Stub", "DAI", "0x6b175474e89094c44da98b954eedeac495271d0f")
  finalContractList.push("DAI")

  publishContract("stubs/", "IWETH9", "WETH", "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")
  finalContractList.push("WETH")

  fs.writeFileSync(
    `${publishDir}/contracts.js`,
    `module.exports = ${JSON.stringify(finalContractList)};`
  );

}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
